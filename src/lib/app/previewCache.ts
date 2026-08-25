import type { ExportResult } from "../../types";

export const MAX_PREVIEW_CACHE_ENTRIES = 12;

export interface PreviewCacheUpdate {
  cache: Record<string, ExportResult>;
  evicted: ExportResult[];
  replaced?: ExportResult;
}

export function updatePreviewCache(
  current: Record<string, ExportResult>,
  key: string,
  result: ExportResult,
  limit = MAX_PREVIEW_CACHE_ENTRIES,
): PreviewCacheUpdate {
  const replaced = current[key];
  const cache = { ...current };
  delete cache[key];
  cache[key] = result;

  const keysToEvict = Object.keys(cache).slice(0, -Math.max(1, limit));
  const evicted = keysToEvict.map((cacheKey) => cache[cacheKey]);
  for (const cacheKey of keysToEvict) delete cache[cacheKey];

  return { cache, evicted, replaced };
}
