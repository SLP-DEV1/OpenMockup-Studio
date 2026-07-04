---
name: photopea-closure-recursion-return
description: Photopea iframe JS engine loses closure variable assignments after recursive function returns — always use direct return values instead of mutating outer scope in walkLayers-style recursion
source: auto-skill
extracted_at: '2026-07-04T07:18:03.499Z'
---

# Photopea Closure Variable Staleness in Recursive Functions

## Problem

In Photopea's iframe JS engine, **closure variable assignments are lost after recursive function returns**. This affects all types of outer-scope mutation:

- `var foundLayer = null` → stays `null` even after being assigned inside recursion
- `var foundPath = ""` → stays `""` even after being assigned a string
- `var foundIndexPath = []` → stays empty even after `.push()` calls in deeper recursion levels
- Object literals `{layer, path}` returned from recursion arrive as `{layer: null, path: ""}`

## Root Cause

Photopea's JS engine (likely an older SpiderMonkey variant) does not preserve outer-scope variable mutations across recursive function call boundaries in iframe-injected scripts. The closure scope is effectively reset or garbage-collected when unwinding from deep recursion.

**This is NOT standard JavaScript behavior** — it's a Photopea-specific quirk that only manifests in the iframe script context, not in normal browser JS.

## Evidence (attempted fixes that all failed)

1. **Object literal return** (`return {layer: layer, path: path}`) → arrived as `{layer: null, path: ""}`
2. **Outer `var foundLayer = null` mutation** → stayed `null` after recursion unwound
3. **Outer array `foundIndexPath.push(i)` mutation** → array remained empty
4. **User's suggested fix with explicit outer vars** (`var foundLayer = null; var foundPath = ""`) → same failure

## Solution: Direct Return Values

Use pure return-value recursion — no outer scope mutation at all:

```javascript
// WRONG — closure variables go stale after recursive returns in Photopea iframe
var foundIndexPath = null;
function walkLayers(layers, parentPath, parentIndexPath) {
  for (var i = 0; i < layers.length; i++) {
    if (match(layer)) {
      foundIndexPath = indexPath;  // ← this assignment is lost after return unwinds
      return true;
    }
    if (layer.layers && layer.layers.length) {
      if (walkLayers(layer.layers, path, indexPath)) return true;
    }
  }
  return false;
}
walkLayers(psdDoc.layers, "", []);
if (!foundIndexPath) { /* not found */ }

// CORRECT — direct return values survive recursion
function walkLayers(layers, parentPath, parentIndexPath) {
  for (var i = 0; i < layers.length; i++) {
    var indexPath = parentIndexPath.slice();
    indexPath.push(i);
    if (match(layer)) {
      return indexPath;  // ← returned directly through the call stack
    }
    try {
      if (layer.layers && layer.layers.length) {
        var subResult = walkLayers(layer.layers, path, indexPath);
        if (subResult) return subResult;  // ← bubble up the array
      }
    } catch(e) {}
  }
  return null;  // ← not found
}

var result = walkLayers(psdDoc.layers, "", []);
if (!result) { /* not found */ }
// use result[0], result[1], ... to navigate layers
```

## Key Details

- Use `.slice()` + `.push(i)` instead of `.concat(i)` for building index paths — both work, but slice+push is slightly more explicit about mutation of the local copy
- Return `null` (not `false`) for "not found" so truthy checks (`if (!result)`) work naturally with arrays
- After getting the index path, **navigate to the layer fresh** from `psdDoc.layers[result[0]]` — don't trust any layer reference that survived recursion
- Apply this pattern to ALL recursive layer-walking code in Photopea scripts: `buildSelectSmartObjectScript`, `buildOpenSmartObjectScript`, `buildForceVisibleScript`, and any future equivalents

## Where Applied

- `src/lib/photopea/scripts.ts` — three functions rewritten with direct return-value pattern
  - `buildSelectSmartObjectScript` (line ~478)
  - `buildOpenSmartObjectScript` (line ~399)
  - `buildForceVisibleScript` (line ~1260)
