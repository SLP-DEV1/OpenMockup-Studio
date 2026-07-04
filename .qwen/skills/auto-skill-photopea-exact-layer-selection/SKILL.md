---
name: photopea-exact-layer-selection
description: Always select Smart Object layers by exact name with recursive search — never use activeLayer fallback after cleanup/cache operations, and throw immediately on error
source: auto-skill
extracted_at: '2026-07-04T05:45:24.425Z'
---

# Exact Layer Selection in Photopea

After preview cleanup or PSD cache reuse, the `activeLayer` in Photopea is often **not** the target Smart Object — it could be "Ungroup" (parent group), "OPENMOCKUP_PLACED_DESIGN", or any other layer that happened to be active during the last operation. **Never use `activeLayer` as a fallback** for finding your target layer after these operations.

## Why `activeLayerFallback` Fails

After cleanup/cache cycles:
- `activeLayer.name` might be `"Ungroup"` (a parent group) or `"OPENMOCKUP_PLACED_DESIGN"` (the placed design layer from a previous preview)
- Normalized comparison (`normalizeLayerName(activeLayer.name) === normalizeLayerName(smartName)`) can produce false positives with similar names
- Using the wrong active layer for subsequent operations corrupts the mockup

**Observed evidence:** `domSearchMiss` + `activeLayerIsPreviewLayer:Ungroup` + `activeLayerFallback:Ungroup` — the fallback selected the parent group instead of "YouR Logo hERE".

## Required Pattern: Recursive Exact-Name Search with Error Abort

### 1. Use `findLayerByPath(layers, targetName, parentPath)` for All Layer Searches

```javascript
function findLayerByPath(layers, targetName, parentPath) {
  if (!layers || !layers.length) return null;
  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    var name = "";
    try { name = layer.name || ""; } catch(e) {}
    var path = parentPath ? parentPath + "/" + name : name;
    app.echoToOE("STEP:smartobject:scan:" + path);
    if (name === targetName) { return { layer: layer, path: path }; }
    try {
      if (layer.layers && layer.layers.length > 0) {
        var found = findLayerByPath(layer.layers, targetName, path);
        if (found) return found;
      }
    } catch(e) {}
  }
  return null;
}

// Usage — always start from psdDoc.layers with empty parent path:
var found = findLayerByPath(psdDoc.layers, smartName, "");
```

**Why `layers[]` not `_path`:** Photopea layer objects don't have a stable `_path` property. Use explicit index-based traversal over `layer.layers[]` arrays with string-based path accumulation for logging.

### 2. ERROR = Throw Immediately — No Fallback After Error

If the target layer is not found, throw an error **immediately**. Do NOT:
- Fall back to `activeLayer`
- Try normalized name matching as a second attempt
- Continue executing subsequent operations (like export) with a wrong or null layer reference

```javascript
if (!found) {
  app.echoToOE("ERROR:smartobject:notFound:" + smartName);
  throw new Error("Target Smart Object not found: " + smartName);
}
// Script stops here — no more execution after ERROR
```

**Rule:** When `ERROR:smartobject:*` or `ERROR:force-visible:*` is logged, the script must NOT continue. No `selectDone`, no fallback, no export attempt.

### 3. Verify Selection After Setting `activeLayer`

After assigning `doc.activeLayer = found.layer`, verify that Photopea actually selected the correct layer:

```javascript
try { psdDoc.activeLayer = found.layer; } catch(e) {}

// Verify selection — exact string comparison, NOT normalized
if (psdDoc.activeLayer.name !== smartName) {
  app.echoToOE("ERROR:smartobject:selectionFailed:" + psdDoc.activeLayer.name);
  throw new Error("Selection verification failed");
}
```

**Why verify:** Photopea sometimes silently fails to change the active layer (e.g., when the target is locked, hidden in a collapsed group, or belongs to another document). The verification catches this before subsequent operations run on the wrong layer.

### 4. Use Exact String Comparison — Not Normalized Matching

In `buildOpenAsSmartInPsdScript` and similar scripts that verify the selected layer:

```javascript
// WRONG — normalized comparison can match wrong layers
if (normalizeLayerName(selectedName) !== normalizeLayerName(expectedSmartName)) { ... }

// CORRECT — exact string comparison only
var selectedName = "";
try { selectedName = doc.activeLayer.name || ""; } catch(e) {}
if (selectedName !== expectedSmartName) {
  app.echoToOE("ERROR:openAsSmartInPsd:wrongActive:" + selectedName);
  throw new Error("Wrong active layer after placement");
}
```

**Why exact:** `normalizeLayerName` strips spaces, lowercases, etc. — this can make "Ungroup" or other layers falsely match the expected Smart Object name in edge cases.

## Anti-Patterns to Remove from Scripts

### ❌ Active Layer Fallback
```javascript
// REMOVE THIS PATTERN:
if (!targetLayer) {
  var activeLayer = psdDoc.activeLayer;
  if (activeLayer && normalizeLayerName(activeLayer.name) === normalizeLayerName(smartName)) {
    targetLayer = activeLayer; // DANGEROUS — could be wrong layer!
  }
}
```

### ❌ Continuing After Error
```javascript
// WRONG — exports even when Smart Object not found:
if (!found) {
  app.echoToOE("ERROR:smartobject:notFound:" + smartName);
}
// ... continues to export with wrong layer!
```

### ❌ `findLayerByName(doc, name)` Without Path Logging
The old `findLayerByName` function lacked path logging (`STEP:smartobject:scan:<path>`), making it impossible to diagnose why a search failed. Always use `findLayerByPath` which logs every scanned node.

## Expected Log Flow (Success)

```
STEP:smartobject:scan:Background
STEP:smartobject:scan:Ungroup
STEP:smartobject:scan:Ungroup/YouR Logo hERE
STEP:smartobject:selected:YouR Logo hERE:path=Ungroup/YouR Logo hERE
STEP:smartobject:selectDone
```

## Expected Log Flow (Not Found)

```
STEP:smartobject:scan:Background
STEP:smartobject:scan:Ungroup
STEP:smartobject:scan:OPENMOCKUP_PLACED_DESIGN
ERROR:smartobject:notFound:YouR Logo hERE
[Script throws — no further execution]
```

## Functions That Use This Pattern

All of these in `scripts.ts` follow the same discipline:
- `buildOpenSmartObjectScript` — opens Smart Object content for editing
- `buildSelectSmartObjectScript` — selects a Smart Object layer by name
- `buildForceVisibleScript` — makes a Smart Object layer visible and selected

Each uses: `findLayerByPath` → ERROR=throw if not found → verify selection after setting activeLayer.
