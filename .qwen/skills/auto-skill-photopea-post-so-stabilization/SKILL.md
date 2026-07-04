---
name: photopea-post-so-stabilization
description: After Smart Object save, stabilize Photopea and force the PSD target layer visible with correct opacity/blend mode before exporting
source: auto-skill
extracted_at: '2026-07-01T10:30:00.000Z'
---

# Post-Smart Object Stabilization & Force Visible

After closing a Smart Object editor with `SAVECHANGES`, Photopea returns focus to the PSD document. However, the target layer in the PSD may end up invisible, have reduced opacity, or an unexpected blend mode — causing the design to appear missing in the final export even though the SO was saved correctly.

## Render Flow Order (After Smart Object Save)

The correct sequence after `saveSmartObjectScript` is:

1. **Save Smart Object** — close SO doc with `SAVECHANGES`, returns focus to PSD
2. **Stabilize** — no-op script (`stabilizeAfterSaveScript`) for Photopea internal state stabilization
3. **Force Visible** — find the target layer in PSD and set `visible=true`, `opacity=100`, `blendMode=NORMAL`
4. **Export PNG** — `saveToOE("png")` with ArrayBuffer + "done" receive pattern

## Stabilize Script (No-Op)

A minimal script that just echoes a marker and returns "done":

```javascript
app.echoToOE("STEP:stabilize:start");
"done";
```

**Why:** Photopea sometimes needs a script cycle to fully resolve internal state after closing a Smart Object editor. Running an empty script gives Photopea time to update document references before the next operation.

## Force Visible Script Pattern

Find the PSD by source marker, then DFS for the target layer by name:

```javascript
// Find PSD via source
var psdDoc = null;
for (var i = 0; i < app.documents.length; i++) {
  if (app.documents[i].source === "OPENMOCKUP_PSD") {
    psdDoc = app.documents[i]; break;
  }
}

// DFS for target layer (flat stack)
var stack = [psdDoc];
var targetLayer = null;
while (stack.length > 0) {
  var parent = stack.pop();
  try { for (var j2 = 0; j2 < parent.layerSets.length; j2++) stack.push(parent.layerSets[j2]); } catch(e){}
  try {
    for (var j3 = 0; j3 < parent.artLayers.length; j3++) {
      if (parent.artLayers[j3].name === smartName) targetLayer = parent.artLayers[j3];
    }
  } catch(e){}
}

// Force visible, opacity 100, blend NORMAL
targetLayer.visible = true;
targetLayer.opacity = 100;
try { targetLayer.blendMode = BlendMode.NORMAL; } catch(e){}
```

**Why:** After SO save, the PSD layer might be hidden by a layer mask, have reduced opacity from previous edits, or use a non-normal blend mode. Forcing these properties ensures the design renders correctly in export.

## What to Log (for debugging)

Log before and after applying force-visible:
- `visible`, `opacity`, `blendMode` — were they already correct?
- `bounds` — does the layer have valid dimensions?
- `layerMask.enabled` — could a mask be hiding the content?
- `layerEffects.length > 0` — could effects be altering appearance?

## How to Apply

Always insert these two steps between Smart Object save and PNG export in any mockup render pipeline:

```typescript
// Step 8: Save Smart Object
await this.runScript(saveSmartObjectScript);

// Step 8.5: Stabilize after SO save
await this.runScript(stabilizeAfterSaveScript);

// Step 8.75: Force visible on PSD target layer
await this.runScript(buildForceVisibleScript(smartObjectName));

// Step 9: Export PNG
const buffer = await this.exportPng();
```

This prevents "invisible design" bugs where the SO saves correctly but the final export shows nothing.
