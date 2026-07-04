---
name: photopea-poll-script-pattern
description: TypeScript-driven polling for async Photopea operations — self-contained poll scripts with inline helpers, always-emitted finish markers, and step-message-based success detection
source: auto-skill
extracted_at: '2026-07-03T17:48:36.611Z'
---

# Photopea Poll Script Pattern

When a Photopea operation takes time (e.g., `app.open(url, null, true)` to place as Smart Object), use a two-phase approach: trigger script + TypeScript polling loop with separate poll scripts.

## 1. Self-Contained Inline Helpers — No PHOTOPEA_HELPERS Dependency

Poll scripts must define their own helper functions inside the template string. Functions like `num()` or `isValidNumber()` do **NOT** exist in `PHOTOPEA_HELPERS` — referencing them causes `"Unknown function num"` crashes.

```javascript
// Inside buildOpenAsSmartInPsdPollScript() return value:
function readNumber(v) {
  if (v === undefined || v === null) return 0;
  var s = String(v);
  if (s === "null" || s === "undefined") return 0;
  s = s.replace(/[a-zA-Z%]+$/, "");  // strip "px", "pt", etc.
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

function readBounds(bounds) {
  if (!bounds) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  var l = readNumber(bounds[0]);
  var t = readNumber(bounds[1]);
  var r = readNumber(bounds[2]);
  var b = readNumber(bounds[3]);
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}
```

**Why:** `PHOTOPEA_HELPERS` provides `unitNumber`, `boundsSize`, `collectionLength`, etc. — but NOT `num()` or `isValidNumber()`. Poll scripts that reference missing functions crash silently with `"Unknown function"` errors. Inline helpers guarantee the script runs regardless of what PHOTOPEA_HELPERS contains.

## 2. Always-Emit Finish Marker (Regardless of Success)

The poll script must always emit a finish marker at the end, even when no success condition is met:

```javascript
// At end of poll script — ALWAYS emitted:
app.echoToOE("STEP:openAsSmartInPsd:pollDone");  // finish marker

// Only emitted on success:
if (foundNewLayer && boundsW > 0) {
  app.echoToOE("STEP:openAsSmartInPsd:bounds=" + bw.toFixed(1) + "x" + bh.toFixed(1));
  app.echoToOE("STEP:openAsSmartInPsd:done");    // success marker
} else {
  app.echoToOE("STEP:openAsSmartInPsd:poll:noNewLayerWithBounds");
}
```

**Why:** TypeScript uses the finish marker (`pollDone`) to know when a poll iteration completed. If no layer is found, the script should NOT throw — it just reports and returns. Throwing causes the pending action to reject, which stops the retry loop prematurely. The finish marker keeps the retry loop alive; success/failure is determined by TypeScript checking collected step messages.

## 3. TypeScript Poll Loop with Step Message Inspection

```typescript
let pollSuccess = false;
for (let poll = 0; poll < 10; poll++) {
  await new Promise((r) => setTimeout(r, 400));
  try {
    // Expect the always-emitted finish marker:
    await this.runScript(buildPollScript(), "STEP:openAsSmartInPsd:pollDone");

    // Check collected step messages for success indicator:
    const hasBounds = this.lastStepMessages.some(
      (m) => m.startsWith("STEP:openAsSmartInPsd:bounds=")
    );
    if (hasBounds) {
      pollSuccess = true;
      break;
    }
  } catch (e) {
    console.warn(`[Photopea] poll ${poll} failed:`, e);
    // Continue retrying — don't abort on individual poll failures
  }
}

if (!pollSuccess) {
  throw new Error("ERROR:openAsSmartInPsd:noLayerCreatedAfterWait");
}
```

**Why:** `runScript` resolves when the finish marker (`pollDone`) is seen. The result string is always `"done"` — it carries no success information. Success/failure must be determined by inspecting `lastStepMessages` for specific markers like `STEP:openAsSmartInPsd:bounds=...`. Individual poll failures (Photopea not ready yet) should NOT abort the loop; only exhaustion of all retries triggers a hard error.

## 4. No `"done"` String Return in Poll Scripts

Do NOT return `"done";` at the end of poll scripts (after the IIFE). Only trigger scripts that complete synchronously use `"done"`. Poll scripts rely entirely on `echoToOE` markers for synchronization:

```javascript
// WRONG — don't add "done" string after poll script IIFE:
})();
"done";  // ← removes this line from poll scripts

// CORRECT — poll script ends with the IIFE closing only:
})();
```

**Why:** The `"done"` string would be sent as a postMessage response and could confuse the message handler into resolving early, before `pollDone` is echoed. Poll scripts should communicate exclusively through STEP markers via `echoToOE`.

## 5. Fire-and-Forgotten Inline Transform — No Error Propagation

When the poll script applies an inline transform after detecting a new layer, call it fire-and-forget:

```javascript
// WRONG — checking return value and emitting ERROR on failure:
var transformOk = applyTransformToLayer(newLayerRef, doc);
if (!transformOk) {
  app.echoToOE("ERROR:openAsSmartInPsd:transformFailed");
}

// CORRECT — fire-and-forget, transform logs its own markers:
applyTransformToLayer(newLayerRef, doc);
```

**Why:** The transform function already emits `STEP:transformPlaced:done` on success and specific `WARN:` or `ERROR:` markers for individual failures. Checking a return value and emitting a blanket error causes correct transforms (e.g., resize succeeded but bounds parse failed) to be treated as total failures. TypeScript should check for the `STEP:transformPlaced:done` marker instead of the return value.

## 6. Early Poll Exit on Transform-Done Marker

The TypeScript poll loop should break not only when a new layer is detected, but also when transform has already finished:

```typescript
const hasCreatedLayer = this.lastStepMessages.some(
  (m) => m.startsWith("STEP:openAsSmartInPsd:createdLayer")
);
const hasTransformDone = this.lastStepMessages.some(
  (m) => m === "STEP:transformPlaced:done"
);
if (hasCreatedLayer || hasTransformDone) {
  pollSuccess = true;
  break;
}
```

**Why:** The inline transform runs in the same script as layer detection. If the layer was detected and transformed, `STEP:transformPlaced:done` will be emitted even if `createdLayer` marker is missing (e.g., path diff edge cases). Waiting only for `createdLayer` causes unnecessary extra poll iterations when the work is already done.

## 7. Error After Exhausted Retries — Single Hard Abort

After all retries are exhausted, throw ONE error with a specific machine-readable prefix:

```typescript
throw new Error("ERROR:openAsSmartInPsd:noLayerCreatedAfterWait");
```

**Why:** The `ERROR:` prefix is caught by the message handler as a fatal error. Using a unique suffix (`noLayerCreatedAfterWait`) lets upstream code distinguish this from other failure modes (parse errors, timeouts, etc.).
