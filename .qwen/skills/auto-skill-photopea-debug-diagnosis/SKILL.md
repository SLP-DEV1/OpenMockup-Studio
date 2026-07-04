---
name: photopea-debug-diagnosis
description: Diagnose Photopea "took too long" errors with step instrumentation, echoToOE markers, source-based identification, and correct script control flow
source: auto-skill
extracted_at: '2026-06-30T21:17:52.326Z'
---

# Photopea Debug Diagnosis

When Photopea reports "took too long to finish this action", the problem is usually NOT insufficient timeout — it's a silent hang caused by running on the wrong document, broken script control flow, or an unhandled state change. Use this diagnostic approach:

## 1. Step-by-Step Instrumentation (Host Side)

Wrap each Photopea operation in `runPhotopeaStep(stepName, label, timeoutMs, action)` that:
- Logs start time via callback before sending
- Logs end time + duration on success or timeout
- Shows current step in UI so the user sees exactly which phase hangs

**Why:** Without per-step timing you only know "something took too long" but not which operation. This reveals whether it's file upload, script execution, or export that fails.

## 2. echoToOE Markers (Photopea Script Side)

Insert `app.echoToOE("STEP:marker-name")` throughout the Photopea JavaScript at every key point:
- Script entry (`start-script`)
- Active document check (`active-document:name`, `doc-count:N`)
- Document identification by source (`psd:name`, `design:name`)
- Layer search (`find-layer`, `layer-found:name`)
- Smart object edit (`edit-smartobject`, `smartobject-opened:name`)
- Design placement (`place-design`, `save-smartobject`)
- Script completion (`script-complete`)

**Why:** Photopea scripts run in an isolated iframe with no console access. `echoToOE` is the only way to send diagnostic messages back to the host app. Host intercepts strings starting with `STEP:` and logs them.

## 3. Source-Based Document Identification (Replaces Filename)

After each file upload, mark the document immediately:
```javascript
// After PSD upload completes
app.activeDocument.source = "OPENMOCKUP_PSD";

// After design upload completes
app.activeDocument.source = "OPENMOCKUP_DESIGN";
```

Then find documents by source instead of filename or index:
```javascript
var psdDoc = null;
for (var i = 0; i < 20; i++) {
  var d = null; try { d = app.documents[i]; } catch(e) {}
  if (!d) break;
  if (d.source === "OPENMOCKUP_PSD") { psdDoc = d; break; }
}
```

**CRITICAL:** Never use `app.documents.length` — it returns `null` in Photopea, not a number. See the auto-skill-photopea-safe-dom-access skill for details.

**Why:** `File.name` does NOT reliably match `app.activeDocument.name` when receiving ArrayBuffer via postMessage — Photopea may rename or truncate. Index-based selection (`documents[-2]`) is equally fragile. Source markers are stable, set by you right after opening.

## 4. Critical: Switch Back to PSD After Opening Design

After `openFile(design)`, Photopea makes the design (PNG/JPG) the active document. Before running SmartObject operations, explicitly switch back using source marker:
```javascript
var found = null;
for (var i = 0; i < app.documents.length; i++) {
  if (app.documents[i].source === "OPENMOCKUP_PSD") {
    found = app.documents[i];
    break;
  }
}
app.activeDocument = found;
```

**Why:** This was the root cause of the original hang. The SmartObject script ran on the PNG document instead of the PSD, causing silent failures with no "done" response.

## 5. Script Control Flow: `found = false` + `break` Pattern (NOT `"done";`)

When searching for a document and then throwing an error if not found, use a flag variable — NOT a bare `"done";` string literal in an if-block:

```javascript
// CORRECT — breaks out of loop, then checks flag after loop:
var found = false;
for (var i = 0; i < app.documents.length; i++) {
  var d = app.documents[i];
  if (d.source === target) {
    app.activeDocument = d;
    found = true;
    break;
  }
}
if (!found) throw new Error("Cannot find document with source: " + target);

// WRONG — "done"; is a string expression, NOT a statement terminator.
// The script falls through to the error even when the document IS found:
for (var i = 0; i < app.documents.length; i++) {
  if (app.documents[i].name === target) {
    app.activeDocument = app.documents[i];
    "done";   // ← does NOTHING to stop execution
  }
}
throw new Error("...");  // ← ALWAYS reached, even when found!
```

**Why:** `"done";` is just a string literal expression in JavaScript — it evaluates and discards. It does NOT `return`, `break`, or terminate the script. The subsequent `throw` always executes, causing every document-switch to fail with an error, which Photopea silently swallows (no "done" sent back → host times out).

## 6. Export: Wait for ArrayBuffer + "done", Not Either Alone

For `saveToOE("png")`, use a two-phase receive pattern:
```typescript
// handleMessage in PhotopeaClient:
if (data instanceof ArrayBuffer && this.pending?.binaryExpected) {
  this.pending.exportBuffer = data;       // cache, don't resolve yet
  return;
}
if (data === "done" && this.pending?.exportBuffer) {
  this.pending.resolve(this.pending.exportBuffer);  // resolve with cached buffer
  return;
}
```

**Why:** `saveToOE` is asynchronous — Photopea sends the ArrayBuffer first, then a separate `"done"` message. Resolving on either alone gives you wrong data (string instead of bytes, or resolving before buffer arrives). The export script must NOT have a trailing `"done";` — that would arrive before the async ArrayBuffer and trigger early resolution.

## 7. Layer-Level Diagnosis with DFS (Flat Stack Pattern)

When you need to inspect the state of layers inside documents (e.g., after Smart Object save), run a flat-stack DFS through `layerSets` and `artLayers`:

```javascript
var stack = [d];  // start with document or layerSet
while (stack.length > 0) {
  var parent = stack.pop();
  try { for (var ls = 0; ls < parent.layerSets.length; ls++) stack.push(parent.layerSets[ls]); } catch(e){}
  try {
    for (var al = 0; al < parent.artLayers.length; al++) {
      var layer = parent.artLayers[al];
      // inspect: name, visible, opacity, blendMode, kind (smartObject), bounds, layerMask
    }
  } catch(e){}
}
```

Log per-layer: `name`, `visible`, `opacity`, `blendMode`, `smartObject` (via `layer.kind === "LayerKind.SMARTOBJECT"`), `bounds`, and `layerMask.enabled`.

**Why:** After Smart Object save, the PSD target layer might be invisible, have low opacity, or wrong blend mode — making the design appear missing even though the SO was saved correctly. This DFS pattern avoids nested recursion (safer in Photopea's JS environment) and catches layered groups.

## How to Apply

When debugging any Photopea integration:
1. Add step instrumentation on the host side first (quickest way to find which phase hangs)
2. Add echoToOE markers in the script for fine-grained diagnosis within that phase
3. Use source-based identification instead of filename or index-based document selection
4. Always switch back to the target document after any operation that might change focus
5. Use `found = false; ... break;` pattern — never use `"done";` as a control flow terminator
6. For PNG export, wait for BOTH ArrayBuffer AND "done" before resolving
7. After Smart Object save, run DFS layer diagnosis to verify the PSD target layer's visibility/opacity state
