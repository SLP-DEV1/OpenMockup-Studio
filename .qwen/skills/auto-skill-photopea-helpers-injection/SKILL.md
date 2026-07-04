---
name: photopea-helpers-injection
description: Functions called by Photopea scripts must be inside the PHOTOPEA_HELPERS template string — TS module-level functions are never sent to the iframe context
source: auto-skill
extracted_at: '2026-07-04T07:10:00.000Z'
---

# Photopea Helpers Injection Mechanism

Photopea scripts are built by concatenating a `PHOTOPEA_HELPERS` template string with script-specific body code, then wrapping the whole thing in try/catch via the `wrap()` function. Only content inside `PHOTOPEA_HELPERS` (or inline in the generated script body) reaches Photopea's JavaScript context.

## Architecture

```typescript
// scripts.ts structure:
const PHOTOPEA_HELPERS = `
  // All shared helper functions live HERE as plain JavaScript text
  function unitNumber(value) { ... }
  function boundsSize(bounds) { ... }
  function findLayerByName(layers, targetName, parentPath) { ... }
  // ... more helpers
`;

function wrap(body: string): string {
  return `${PHOTOPEA_HELPERS}
try {
${body}
} catch(e) {
  app.echoToOE("ERROR:" + (e.message || e));
}`;
}

// Usage — every exported script uses wrap():
export const markPsdScript = wrap(`...`);
export function buildSelectSmartObjectScript(name: string): string {
  return wrap(`findLayerByName(app.activeDocument.layers, ${esc(name)}, ""); ...`);
}
```

## The Trap: TS Module Functions vs. Injected JavaScript

**Functions defined as TypeScript module-level functions are NEVER sent to Photopea:**

```typescript
// ❌ WRONG — this is a TS function, NOT in PHOTOPEA_HELPERS
function findLayerByName(layers, targetName) { ... }  // lives only in Node/TS runtime

export function buildSelectSmartObjectScript(name: string): string {
  return wrap(`findLayerByName(doc.layers, "${name}");`);  
  // Photopea receives the call, but findLayerByName doesn't exist → crash!
}
```

**Functions must be inside PHOTOPEA_HELPERS template string:**

```typescript
// ✅ CORRECT — inside PHOTOPEA_HELPERS, sent as text to every script
const PHOTOPEA_HELPERS = `
function findLayerByName(layers, targetName, parentPath) { ... }
`;

export function buildSelectSmartObjectScript(name: string): string {
  return wrap(`findLayerByName(doc.layers, "${name}");`);  
  // Photopea receives both the helper definition AND the call → works!
}
```

## Symptom of Missing Helper

When a function is called but not present in PHOTOPEA_HELPERS:

1. **Photopea console:** `ReferenceError: findLayerByName is not defined` or similar
2. **Host log:** The script runs, hits the catch block, emits `ERROR:...` with no useful detail because the error message is generic
3. **Upstream effect:** Operations silently fail — e.g., Smart Object not selected, export uses wrong layer

**Diagnosis pattern:** If a generated script references a function that isn't found by searching inside `PHOTOPEA_HELPERS`, it will crash at runtime in Photopea even though TypeScript compilation succeeds (TS sees the call as plain string text).

## Rule: Two Categories of Functions

| Category | Location | Example |
|----------|----------|---------|
| **Shared helpers** | Inside `PHOTOPEA_HELPERS` template string | `findLayerByName`, `cleanName`, `looseName`, `unitNumber`, `boundsSize`, `collectionLength`, `forceLayerVisible`, `collectArtLayers` |
| **Script builders** | TS module functions returning strings | `buildSelectSmartObjectScript()`, `buildOpenAsSmartInPsdScript()`, `wrap()` |

Shared helpers are plain JavaScript text (no types, no imports). Script builders use `esc()`, `numberLiteral()`, and template literals to inject values.

## Adding a New Helper

When you need a helper function in Photopea scripts:

1. Write the function as **plain JavaScript** inside `PHOTOPEA_HELPERS` (before the closing backtick)
2. Do NOT add it as a TS module-level function — that creates a dead copy
3. Call it from any generated script body passed to `wrap()` or direct template strings

```typescript
// Step 1: Add inside PHOTOPEA_HELPERS
const PHOTOPEA_HELPERS = `
...existing helpers...

function myNewHelper(arg) {
  return String(arg || "").trim();
}
`;  // ← closing backtick AFTER the new helper

// Step 2: Use in any script
export function buildMyScript(value: string): string {
  return wrap(`var result = myNewHelper(${esc(value)});`);
}
```

## Poll Scripts Exception

Poll scripts (e.g., `buildOpenAsSmartInPsdPollScript`) are **self-contained** — they define inline helpers inside their own template string rather than relying on PHOTOPEA_HELPERS. See the `photopea-poll-script-pattern` skill for details. This is intentional because poll scripts run independently and should not depend on shared state from PHOTOPEA_HELPERS.

## Why This Matters

The `PHOTOPEA_HELPERS` approach means:
- Every script gets all helpers automatically via `wrap()`
- No duplication of helper code across multiple script builders
- Changes to helpers propagate to all scripts that use `wrap()`
- TypeScript compilation cannot catch missing helpers (they're just strings) — manual verification is required
