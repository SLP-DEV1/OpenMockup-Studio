---
name: photopea-dimension-access-patterns
description: Never use unitNumber(), layer.width/height, or layer.bounds for transform calculations — inject all dimensions as plain number parameters from TypeScript instead (project)
source: auto-skill
extracted_at: '2026-07-03T20:42:13.592Z'
---

# Photopea Dimension Access Patterns

Photopea's sandboxed JavaScript environment has several traps for dimension access that cause silent null/NaN values in transform calculations. Always inject dimensions as plain numbers from TypeScript instead of reading them inside Photopea scripts.

## 1. Never Use `unitNumber()` — It Doesn't Exist in the Sandbox

```javascript
// WRONG — crashes with "Unknown function unitNumber":
var docW = unitNumber(doc.width);       // null
var layerW = unitNumber(layer.width);   // null
var left = unitNumber(layer.bounds[0]); // null

// RESULT: All transform calculations produce 0,0,0,0 targets
```

**Why:** `unitNumber()` is NOT available in Photopea's JS context. It exists in Adobe ExtendScript but not in Photopea's implementation. Even if it were available, `doc.width`/`doc.height` return UnitValue objects that can't be converted reliably.

## 2. Never Use `layer.width` / `layer.height` — They Return Objects, Not Numbers

```javascript
// WRONG:
var layerW = layer.width;   // Returns {BX: 'Layer'} object, not a number
var layerH = layer.height;  // Same
app.echoToOE(layerW);       // Logs "{BX: 'Layer'}" — not usable for math
```

**Why:** In Photopea's sandbox, `layer.width` and `layer.height` return internal proxy objects (`{BX: 'Layer'}`), not numeric pixel values. Any arithmetic on these produces NaN or 0.

## 3. Never Use `layer.bounds[]` — Unreliable in Sandbox

```javascript
// WRONG:
var currentLeft = layer.bounds[0];   // Returns undefined, null, or proxy object
var currentTop = layer.bounds[1];    // Same problem
```

**Why:** `layer.bounds` can be null, have missing indices, or contain values without `.value`. Even when it works, the returned values are UnitValue objects that need conversion via a safe parser (see Safe DOM Access skill). For transform calculations, avoid reading bounds entirely.

## 4. Inject All Dimensions as Plain Number Parameters

The correct approach: Pass all dimensions from TypeScript where they're known as real numbers:

```typescript
// In scripts.ts — function signature accepts plain numbers:
export function buildOpenAsSmartInPsdPollScript(
  left = 0, top = 0, width = 100, height = 100,
  rotation = 0, opacity = 100, fitMode = "contain", anchor = "center",
  designWidth = 0, designHeight = 0,
  docWidth = 0, docHeight = 0,           // ← injected PSD dimensions
): string {
```

```javascript
// Inside the generated script — use template literals to embed numbers:
var docW = ${docWidth};       // e.g., var docW = 3000;
var docH = ${docHeight};      // e.g., var docH = 2000;
var dw = ${designWidth};      // e.g., var dw = 800;
var dh = ${designHeight};     // e.g., var dh = 600;

// Now all calculations work with real numbers:
var targetX = docW * ${left} / 100;
var targetY = docH * ${top} / 100;
```

**Why:** TypeScript knows the design dimensions (from `Image.naturalWidth/Height`) and can read PSD dimensions via a separate script. Embedding them as literal numbers in the generated JS guarantees no null/NaN at runtime.

## 5. Apply Transform Using Known Dimensions — No Bounds Reading

When positioning, use simple `translate()` with injected target values instead of reading current bounds:

```javascript
// WRONG — reads layer.bounds which is unreliable:
var currentLeft = unitNumber(layer.bounds[0]);
var deltaX = anchorX - currentLeft;
layer.translate(deltaX, deltaY);

// CORRECT — resize with percentage, then simple translate:
doc.activeLayer = newLayer;
newLayer.resize(scalePercent, scalePercent, AnchorPosition.TOPLEFT);
if (targetX !== 0 || targetY !== 0) {
  layer.translate(targetX, targetY);
}
```

**Why:** After `app.open(url, null, true)` places a Smart Object, Photopea positions it at some default location. Since we can't read bounds reliably, skip absolute positioning entirely and use simple relative translate with injected values. When `targetX === 0` and `targetY === 0`, skip the translate call altogether to avoid unnecessary errors.

## 5b. Bounds Parse Failures Are Warnings Only — Never Hard Errors

If you need to log bounds for diagnostics, wrap in try/catch and emit only a warning:

```javascript
// Bounds read is diagnostic only — never block on failure:
try {
  var b = layer.bounds;
  if (b && b.length >= 4) {
    var curLeft = parseFloat(String(b[0]).replace(/[^0-9.-]/g, ""));
    var curTop = parseFloat(String(b[1]).replace(/[^0-9.-]/g, ""));
    if (!isNaN(curLeft) && !isNaN(curTop)) {
      app.echoToOE("STEP:transformPlaced:bounds:" + curLeft.toFixed(1) + "," + curTop.toFixed(1));
    } else {
      app.echoToOE("WARN:transformPlaced:boundsParseFailed");  // warning, not error
    }
  }
} catch(e) {
  app.echoToOE("WARN:transformPlaced:boundsRead:" + e.message);
}
// Continue to next step regardless of bounds result
```

**Why:** `layer.bounds` is inherently unreliable in Photopea's sandbox — it can return proxy objects, null, or values without `.value`. A parse failure here does NOT mean the transform failed. The resize already happened with injected dimensions. Treating bounds failures as hard errors causes correct transforms to be aborted unnecessarily (e.g., `ERROR:openAsSmartInPsd:transformFailed` after a successful resize).

**Rule:** Never throw or emit `ERROR:` based solely on bounds parsing. Use `WARN:` prefix and continue.

## 6. PSD Document Dimensions — Read Once via Dedicated Script

PSD files can't be read via `new Image()` (only image formats work). To get document dimensions:

```typescript
// Option A: Read in Photopea after opening the PSD, before placing designs
const docSizeScript = buildReadDocSizeScript();  // emits STEP:docSize:WxH markers
await this.runScript(docSizeScript, "STEP:readDocSize:done");
// Parse W and H from step messages

// Option B: Embed in a script that runs after PSD open
function buildReadDocSizeScript(): string {
  return `
    (function() {
      var doc = app.activeDocument;
      if (!doc) { app.echoToOE("STEP:readDocSize:error:noDoc"); return "error"; }
      // Read width/height — these ARE available on the Document object
      // even though unitNumber doesn't work, String conversion works:
      var w = String(doc.width).replace(/[^0-9.]/g, "");
      var h = String(doc.height).replace(/[^0-9.]/g, "");
      app.echoToOE("STEP:readDocSize:" + w + "x" + h);
    })();
    "done";
  `;
}
```

**Why:** After opening a PSD via `app.open()`, the document object has `.width` and `.height` as UnitValue objects. Converting to string and stripping non-numeric characters gives pixel values (Photopea default unit). Read this once after opening, cache in TypeScript, pass to subsequent scripts.

## 7. Expected Log Output for Working Transform

When everything works correctly:

```
STEP:transformPlaced:start
STEP:transformPlaced:targetLayer:OPENMOCKUP_PLACED_DESIGN
STEP:transformPlaced:docSize:3000x2000        // ← real numbers, not null
STEP:transformPlaced:designSize:800x600       // ← from injected parameters
STEP:transformPlaced:fitMode:contain          // ← or cover/width/height
STEP:transformPlaced:target:300.0,200.0,1500.0,1000.0  // ← non-zero values
STEP:transformPlaced:scale:0.7500             // ← meaningful scale factor
STEP:transformPlaced:done
```

**Diagnosis:** If you see `docSize:nullxnull` or `target:0.0,0.0,0.0,0.0`, the script is still using `unitNumber()` or reading dimensions from Photopea objects instead of injected parameters.

## Reference: What Works vs What Doesn't in Photopea Sandbox

| API | Works? | Returns |
|-----|--------|---------|
| `doc.width` / `doc.height` | Partially | UnitValue object, needs string parsing |
| `layer.width` / `layer.height` | NO | `{BX: 'Layer'}` proxy object |
| `layer.bounds[]` | Unreliable | null/undefined/proxy depending on layer type |
| `unitNumber()` | NO | "Unknown function" error |
| Injected template literal `${value}` | YES | Plain number in generated JS |
| `String(doc.width).replace(...)` | YES | Parseable pixel value |
