---
name: photopea-psd-cache-preview-reuse
description: Cache PSD in Photopea iframe across multiple previews — skip file transfer and document reload when the same PSD is reused, only swap the design layer for 2-4s preview cycles
source: auto-skill
extracted_at: '2026-07-03T18:57:16.643Z'
---

# Photopea PSD Cache & Preview Reuse

When users repeatedly generate previews with the same PSD template but different design assets, reloading the full PSD each time wastes 6–8 seconds on file transfer and document parsing. The solution is to keep the PSD persistent in the Photopea iframe and only swap the design layer per preview.

## Cache Key: File Metadata Comparison

Track the currently loaded PSD using a lightweight cache key derived from `File` properties:

```typescript
interface PsdCacheKey {
  name: string;
  size: number;
  lastModified: number;
}

function psdCacheKey(psd: File): PsdCacheKey {
  return { name: psd.name, size: psd.size, lastModified: psd.lastModified };
}
```

Store it as `private loadedPsdKey: PsdCacheKey | null = null` on the client class. Compare with strict equality on all three fields — if they match, skip the full PSD reload.

**Why:** Photopea receives the PSD via `postMessage(ArrayBuffer)` which triggers a full parse cycle (6–8s for complex templates). Reusing the already-parsed document in the iframe cuts subsequent previews to 2–4s because only the Smart Object swap runs.

## Render Flow with Caching

### First Preview (psdCache:load)
Full pipeline — no cache hit:

1. `closeAllDocuments()` — clean slate
2. `sendFile(psd)` — upload PSD ArrayBuffer
3. `markPsdScript` — set `app.activeDocument.source = "OPENMOCKUP_PSD"`
4. Store `loadedPsdKey = psdCacheKey(psd)`
5. Normal Smart Object placement + export (steps 4–8)

### Subsequent Preview, Same PSD (psdCache:reuse)
Skip document-loading steps:

1. **Skip** `closeAllDocuments()` — PSD stays open
2. **Skip** `sendFile(psd)` — no file transfer
3. **Skip** `markPsdScript` — source marker already set
4. Run `buildPreviewCleanupScript()` — remove old design layer from previous preview
5. Normal Smart Object placement + export (steps 4–8)

### New PSD or Reset
Call `resetPsdCache()` to clear `loadedPsdKey`. Triggers: user uploads a different PSD, explicit reset button, Photopea re-initialization, or fatal error recovery.

## Preview Cleanup Script

Before inserting the new design on cached previews, remove the old one:

```javascript
// buildPreviewCleanupScript — finds and removes OPENMOCKUP_PLACED_DESIGN from previous preview
function hideLayerByName(layerRef, targetName) {
  try {
    if (layerRef.name === targetName) {
      layerRef.visible = false;
      return true;
    }
    if (layerRef.layers && layerRef.layers.length > 0) {
      for (var i = 0; i < layerRef.layers.length; i++) {
        if (hideLayerByName(layerRef.layers[i], targetName)) return true;
      }
    }
  } catch(e) {}
  return false;
}

try {
  var doc = switchToDocumentBySource("OPENMOCKUP_PSD");
  var removed = 0;
  for (var i = 0; i < doc.layers.length; i++) {
    if (hideLayerByName(doc.layers[i], "OPENMOCKUP_PLACED_DESIGN")) { removed++; }
  }
  app.echoToOE("STEP:previewCleanup:removed:" + removed);
} catch(e) {
  app.echoToOE("STEP:previewCleanup:none");
}
app.echoToOE("STEP:previewCleanup:done");
"done";
```

**Critical:** Never delete the `Mask`, `Ungroup`, `body`, or `BG` groups. Only target layers named `OPENMOCKUP_PLACED_DESIGN`. Hide (don't delete) to allow undo-friendly reuse — Photopea's DOM API can be fragile with `.remove()` on Smart Object layers.

## Log Markers for Cache State

Emit distinct markers so the host can distinguish cache load vs reuse:

- `STEP:psdCache:load` — first preview, full PSD loaded
- `STEP:psdCache:reuse` — subsequent preview, same PSD reused
- `STEP:previewCleanup:removed:N` — N old design layers hidden/removed
- `STEP:previewCleanup:none` — no previous design layer found (first run or already clean)

## What NOT to Skip on Cached Previews

Even when the PSD is cached, these steps must still run:

1. **Smart Object selection** (`buildSelectSmartObjectScript`) — the target SO layer may have been deselected by cleanup
2. **`app.open(url, null, true)`** — this is where the new design enters as a Smart Object
3. **Poll script with path diff detection** — each preview creates a fresh layer that needs renaming to `OPENMOCKUP_PLACED_DESIGN`
4. **Export PNG** — obviously needed for every preview

## How to Apply

In your render method (e.g., `renderMockup`), add the cache check at the top:

```typescript
async renderMockup(psd: File, design: File, settings: MockupSettings): Promise<Blob> {
  await this.waitUntilReady();
  const currentKey = psdCacheKey(psd);
  const cached = psdCacheKeysEqual(this.loadedPsdKey, currentKey);

  if (cached) {
    console.log("[Photopea] PSD cache hit — skipping reload");
    // Emit STEP:psdCache:reuse
    await this.runPreviewCleanup();   // remove old OPENMOCKUP_PLACED_DESIGN
  } else {
    console.log("[Photopea] PSD cache miss — full load");
    this.loadedPsdKey = currentKey;
    // Emit STEP:psdCache:load
    await this.closeAllDocuments();
    await this.openFile(psd);
    await this.runScript(markPsdScript, "STEP:mark:psd:done");
  }

  // ... continue with Smart Object placement (steps 3–8)
}
```

## Performance Target

- First preview: ~8–10 seconds (full PSD load + parse + Smart Object swap + export)
- Subsequent previews, same PSD: ~2–4 seconds (cleanup + Smart Object swap + export only)
- The bottleneck on cached previews is the `app.open()` network fetch for the design URL — ensure the design endpoint serves fast
