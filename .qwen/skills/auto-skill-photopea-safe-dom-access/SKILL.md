---
name: photopea-safe-dom-access
description: Safe access patterns for Photopea DOM APIs — index-based document enumeration, safe number parsing with NaN guards, and single-script consolidation to prevent value propagation across script boundaries
source: auto-skill
extracted_at: '2026-07-03T14:42:17.136Z'
---

# Photopea Safe DOM Access Patterns

Photopea's JavaScript environment has several traps that cause silent crashes or NaN propagation. Use these safe patterns instead of naive DOM access.

## 1. Never Use `app.documents.length` — It Returns `null`

In Photopea, `app.documents.length` returns `null`, not a number. Any comparison like `< 2` becomes `NaN < 2` → `false`, breaking all document-count logic.

**Wrong:**
```javascript
if (app.documents.length < 2) throw new Error("not enough docs");
for (var i = 0; i < app.documents.length; i++) { ... }
while (app.documents.length > 0) { ... }
```

**Correct — Index-Based Enumeration with Guard:**
```javascript
// Count documents safely
var docCount = 0;
for (var di = 0; di < 20; di++) {
  try { if (app.documents[di]) docCount++; } catch(e) {}
}

// Enumerate documents safely
for (var i = 0; i < 20; i++) {
  var d = null;
  try { d = app.documents[i]; } catch(e) {}
  if (!d) break;
  // use d...
}
```

**Why:** Photopea's `app.documents` is not a standard JavaScript array — `.length` is undefined/null. Index access with try/catch and null-break is the only reliable way to enumerate documents. The limit of 20 covers all realistic scenarios (mockup pipelines use ≤3 docs).

## 2. Safe Number Extraction from Photopea Values

Photopea dimension/bounds values don't have a consistent `.value` property. Accessing `.value` on null/undefined produces `NaN`, which silently propagates through calculations and crashes resize operations with `"Cannot read properties of undefined (reading 'add')"`.

**Safe `num()` Helper:**
```javascript
function num(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v.value === "number") return v.value;
  var s = String(v);
  return parseFloat(s.replace(/[^0-9.\-]/g, ""));
}
```

**Safe Bounds Function with Fallback:**
```javascript
function getBoundsSize(layer) {
  try {
    var b = layer.bounds;
    if (!b || !Array.isArray(b)) return null;
    var w = num(b[2]) - num(b[0]);
    var h = num(b[3]) - num(b[1]);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
    return { w: w, h: h };
  } catch(e) { return null; }
}
```

**Why:** `layer.bounds` can be null, have missing indices, or contain values without `.value`. Returning `null` on failure instead of propagating NaN lets the caller provide a fallback (e.g., design document dimensions).

## 3. NaN Guards Before Transform Operations

Before any resize/translate/scale operation, validate ALL numeric inputs:

```javascript
function isValidNumber(v) {
  return typeof v === "number" && !isNaN(v) && isFinite(v) && v > 0;
}

// Guard before transform
if (!isValidNumber(soW) || !isValidNumber(boxW) || !isValidNumber(scale)) {
  throw new Error("place:invalidTransformValues:" + soW + "," + boxW + "," + scale);
}
```

**Why:** A single NaN in a resize calculation can cause Photopea to crash with cryptic errors like `"Cannot read properties of undefined (reading 'add')"`. Explicit guards give clear error messages and prevent corrupted transforms.

## 4. Single-Script Consolidation to Prevent Cross-Script NaN Propagation

Related operations that share state should run in ONE script, not multiple separate scripts sent via postMessage:

```javascript
// WRONG — two scripts, NaN from bounds can escape between them
await runScript(duplicateScript);     // produces layer with NaN bounds
await runScript(resizeScript);        // crashes on NaN input

// CORRECT — one script, NaN caught before resize runs
await runScript(`
  // Phase 1: duplicate
  var duped = sourceLayer.duplicate(targetDoc, ElementPlacement.PLACEATBEGINNING);
  
  // Phase 2: safe bounds with fallback
  var size = getBoundsSize(duped);
  if (!size) { size = { w: designW, h: designH }; } // fallback
  
  // Phase 3: resize (guaranteed valid numbers now)
  duped.resize(size.w / targetW * 100, ...);
`);
```

**Why:** Each postMessage script runs in isolation. If Script A produces NaN values and doesn't throw, Script B receives corrupted state with no way to detect it. Consolidating into one script lets you validate intermediate results before proceeding.

## 5. Fallback Strategy for Failed Bounds

When `getBoundsSize()` returns null, use the source document's dimensions as fallback:

```javascript
// Save design dimensions early (always reliable from Document object)
var designW = num(app.activeDocument.width);
var designH = num(app.activeDocument.height);

// Later, when bounds fail:
var size = getBoundsSize(dupedLayer);
if (!size) {
  app.echoToOE("STEP:duplicate:boundsFallback:" + designW + "x" + designH);
  size = { w: designW, h: designH };
}
```

**Why:** The source layer's bounds should match the document dimensions (for full-canvas designs). Document `.width`/`.height` are more stable than `layer.bounds`.

## 6. Never Use `$.sleep()` in Photopea Scripts — It Crashes

Photopea's JavaScript engine does NOT support `$.sleep()`. Calling it causes:

```
Uncaught sleep
```

This crashes the entire script silently, with no "done" sent back to the host → timeout.

**Wrong:**
```javascript
// Polling inside Photopea script — CRASHES on $.sleep
for (var attempt = 0; attempt < 50; attempt++) {
  $.sleep(100);  // ← Uncaught sleep!
  if (doc.layers.length > beforeCount) break;
}
```

**Correct — TypeScript Polling Pattern:**
Split into two phases: a Photopea script that triggers the operation and ends immediately, then a TypeScript loop that polls with separate diagnostic scripts.

```typescript
// Phase A: Trigger async operation in Photopea (no waiting inside)
await this.runScript(buildOpenAsSmartInPsdScript(url), "STEP:openCalled");

// Phase B: Poll from TypeScript between script invocations
for (let poll = 0; poll < 10; poll++) {
  await new Promise(r => setTimeout(r, 400));  // ← wait in TypeScript, NOT Photopea
  const result = await this.runScript(buildPollScript(), "STEP:done");
  if (result === "done") break;
}
```

The poll script itself reads state and logs markers but never waits:

```javascript
// Poll script — no sleep, just read and report
var layerCount = 0;
for (var i = 0; i < 200; i++) {
  try { if (!doc.layers[i]) break; layerCount++; } catch(e) {}
}
app.echoToOE("STEP:poll:layerCount:" + layerCount);
// ... check bounds, emit done or noNewLayerWithBounds
```

**Why:** Photopea's JS environment is a restricted subset. `$.sleep` exists in Adobe ExtendScript but not in Photopea's implementation. All waiting must happen on the host (TypeScript) side between script invocations via `setTimeout`.

## 7. Use `app.open(url, null, true)` Instead of `placedLayerReplaceContents`

The `executeAction(stringIDToTypeID("placedLayerReplaceContents"), ...)` approach with URL descriptors does NOT work in Photopea — it triggers a browser file chooser dialog:

```
File chooser dialog can only be shown with a user activation.
```

This returns immediately without actually replacing the Smart Object contents, making it look like success when nothing happened.

**Wrong:**
```javascript
// Triggers file chooser, does NOT load from URL
var desc = new ActionDescriptor();
desc.putString(charIDToTypeID("null"), designUrl);
executeAction(stringIDToTypeID("placedLayerReplaceContents"), desc, DialogModes.NO);
```

**Correct — `app.open()` with third param `true`:**
```javascript
// PSD document is active, target layer is selected
var doc = switchToDocumentBySource("OPENMOCKUP_PSD");
doc.activeLayer = targetLayer;  // select the Smart Object layer first
app.open(designUrl, null, true);  // third param = open as placed Smart Object
```

The `true` parameter tells Photopea to place the image as a new Smart Object layer in the active document. After calling `app.open()`, poll from TypeScript until a new layer appears with valid bounds > 0.

**Why:** Photopea runs in an iframe and cannot show native file dialogs programmatically. ActionDescriptor-based file operations fail silently or trigger blocked dialogs. The `app.open()` API works because it uses the URL directly without requiring user interaction.

## How to Apply

When writing Photopea scripts in this project:

1. **Never use `.length` on any Photopea collection** — always index-based enumeration with try/catch and null-break
2. **Always wrap number extraction in `num()` or equivalent** — never assume `.value` exists
3. **Guard all transform inputs with `isValidNumber()`** — fail fast with clear error markers
4. **Consolidate related operations into single scripts** — prevent NaN from escaping between script boundaries
5. **Provide fallback dimensions** when bounds extraction fails
6. **Never use `$.sleep()` in Photopea scripts** — do all waiting in TypeScript via `setTimeout` between separate script invocations
7. **Use `app.open(url, null, true)` for Smart Object placement** — never use `placedLayerReplaceContents` with URL descriptors

These patterns were discovered through debugging the export pipeline crash sequence: duplicate → NaN bounds → resize crash → sleep crash → file chooser dialog. Each fix revealed another trap until all DOM access and execution was made defensive.
