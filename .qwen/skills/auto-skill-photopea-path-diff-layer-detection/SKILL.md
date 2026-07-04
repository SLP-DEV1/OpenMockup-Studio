---
name: photopea-path-diff-layer-detection
description: Detect newly placed layers by comparing recursive path snapshots before and after async operations — replaces unreliable bounds checking when Photopea returns 0x0 dimensions
source: auto-skill
extracted_at: '2026-07-03T18:30:00.000Z'
---

# Path-Diff Layer Detection in Photopea

When `app.open(url, null, true)` or other async placement operations create new layers, **do NOT use bounds as a success criterion** — Photopea returns 0x0 for all layer bounds unconditionally (root cause unknown). Instead, detect the new layer by comparing recursive path snapshots before and after the operation.

## Why Bounds Fail

Every call to `layer.bounds` in Photopea returns values that resolve to width=0, height=0 regardless of actual content. This makes any bounds-based success check (`width > 0 && height > 0`) always fail silently.

**Observed evidence:** Layer count increased from 12→13 after `app.open()`, confirming the import worked — but all layers reported bounds as 0x0. The operation succeeded; only the bounds reading was broken.

## Two-Phase Path Diff Pattern

### Phase A: Trigger Script — Collect Baseline Paths Before Operation

```javascript
// Self-contained helper (no external dependencies)
function collectLayerPaths(layerRef, parentPath, results) {
  try {
    var name = layerRef.name || "?";
    var path = parentPath ? parentPath + "/" + name : name;
    results.push(path);

    // Recurse into LayerSet (group) children
    if (layerRef.layers && layerRef.layers.length > 0) {
      for (var i = 0; i < layerRef.layers.length; i++) {
        try { collectLayerPaths(layerRef.layers[i], path, results); } catch(e) {}
      }
    }
  } catch(e) {}
}

// Collect baseline BEFORE app.open()
var beforePaths = [];
for (var i = 0; i < doc.layers.length; i++) {
  try { collectLayerPaths(doc.layers[i], "", beforePaths); } catch(e) {}
}

// Store on window for the poll script to read later
window.__openmockupBaseline = beforePaths;
app.echoToOE("STEP:baseline:" + beforePaths.length);

// Now trigger the async operation
app.open(designUrl, null, true);
app.echoToOE("STEP:openCalled");
```

**Why store on `window`:** The trigger script and poll script run in separate postMessage invocations. There's no shared variable scope between them — `window` is the only cross-script communication channel available in Photopea's iframe environment.

### Phase B: Poll Script — Compare Against Baseline to Find New Layer

```javascript
// Read baseline from trigger script
var beforePaths = window.__openmockupBaseline || [];

// Collect current paths
function collectLayerPaths(layerRef, parentPath, results) {
  try {
    var name = layerRef.name || "?";
    var path = parentPath ? parentPath + "/" + name : name;
    results.push(path);

    if (layerRef.layers && layerRef.layers.length > 0) {
      for (var i = 0; i < layerRef.layers.length; i++) {
        try { collectLayerPaths(layerRef.layers[i], path, results); } catch(e) {}
      }
    }
  } catch(e) {}
}

var afterPaths = [];
for (var i = 0; i < doc.layers.length; i++) {
  try { collectLayerPaths(doc.layers[i], "", afterPaths); } catch(e) {}
}

// Find new path (in after but not in before)
var newPath = null;
for (var j = 0; j < afterPaths.length; j++) {
  if (beforePaths.indexOf(afterPaths[j]) === -1) {
    newPath = afterPaths[j];
    break;
  }
}

if (newPath) {
  app.echoToOE("STEP:openAsSmartInPsd:createdLayer:" + newPath);
  // Continue with rename, hide old layer, etc.
} else {
  app.echoToOE("STEP:openAsSmartInPsd:poll:noNewLayer");
}

// Always emit finish marker
app.echoToOE("STEP:openAsSmartInPsd:pollDone");
```

## Finding the Layer Reference from a Path

Once you know the new path string, navigate to the actual layer reference for renaming or activation:

```javascript
function findLayerByPath(layerRef, pathParts, depth) {
  try {
    if (depth >= pathParts.length) return layerRef;
    var targetName = pathParts[depth];

    if (layerRef.layers && layerRef.layers.length > 0) {
      for (var i = 0; i < layerRef.layers.length; i++) {
        try {
          if (layerRef.layers[i].name === targetName) {
            return findLayerByPath(layerRef.layers[i], pathParts, depth + 1);
          }
        } catch(e) {}
      }
    }
  } catch(e) {}
  return null;
}

// Usage:
var newLayer = findLayerByPath(doc, newPath.split("/"), 0);
if (newLayer) {
  doc.activeLayer = newLayer;           // activate
  newLayer.name = "OPENMOCKUP_PLACED_DESIGN"; // rename
  app.echoToOE("STEP:openAsSmartInPsd:renamed:OPENMOCKUP_PLACED_DESIGN");
}
```

## Hiding Old Smart Object Layers by Exact Name

After placing the new design, hide the placeholder layer (do NOT delete groups):

```javascript
function findAndHideLayerByName(layerRef, targetName) {
  try {
    if (layerRef.name === targetName) {
      layerRef.visible = false;
      return true;
    }
    if (layerRef.layers && layerRef.layers.length > 0) {
      for (var i = 0; i < layerRef.layers.length; i++) {
        try {
          if (findAndHideLayerByName(layerRef.layers[i], targetName)) return true;
        } catch(e) {}
      }
    }
  } catch(e) {}
  return false;
}

// Hide only the specific placeholder layer, not its parent group
findAndHideLayerByName(doc, "YouR Logo hERE");
```

**Why hide instead of delete:** Deleting a Smart Object layer can also remove its parent group (e.g., `Mask`), breaking the mockup structure. Hiding preserves the group hierarchy.

## TypeScript Success Check — Use `createdLayer` Marker

In the poll loop, check for path-diff success instead of bounds:

```typescript
let pollSuccess = false;
for (let poll = 0; poll < 10; poll++) {
  await new Promise(r => setTimeout(r, 400));
  try {
    await this.runScript(buildPollScript(), "STEP:openAsSmartInPsd:pollDone");

    const hasNewLayer = this.lastStepMessages.some(
      m => m.startsWith("STEP:openAsSmartInPsd:createdLayer:")
    );
    if (hasNewLayer) {
      pollSuccess = true;
      break;
    }
  } catch (e) {
    console.warn(`[Photopea] poll ${poll} failed:`, e);
  }
}

if (!pollSuccess) {
  throw new Error("ERROR:openAsSmartInPsd:noLayerCreatedAfterWait");
}
```

## What NOT to Do

- **Do NOT access `.isSmartObject` or `.layerKind`** — Photopea throws console errors for these properties. Use path diff instead of type detection.
- **Do NOT use bounds as success criterion** — always 0x0, not usable.
- **Do NOT rely on `layerCount` increase alone** — a layer count change doesn't tell you WHICH layer is new or where to find it for renaming.

## How to Apply

Use this pattern whenever you need to detect and manipulate layers created by async Photopea operations (`app.open`, paste, duplicate across documents). The path-diff approach works regardless of whether bounds are readable, making it more robust than the old bounds-based method.
