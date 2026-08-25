import { describe, expect, it } from "vitest";
import type { ExportResult } from "../../types";
import { updatePreviewCache } from "./previewCache";

function result(name: string): ExportResult {
  return { fileName: `${name}.png`, blob: new Blob([name]), url: `blob:${name}` };
}

describe("updatePreviewCache", () => {
  it("adds a result without mutating the current cache", () => {
    const current = { first: result("first") };
    const update = updatePreviewCache(current, "second", result("second"), 2);

    expect(Object.keys(update.cache)).toEqual(["first", "second"]);
    expect(Object.keys(current)).toEqual(["first"]);
    expect(update.evicted).toEqual([]);
  });

  it("evicts the oldest entries when the limit is exceeded", () => {
    const first = result("first");
    const update = updatePreviewCache(
      { first, second: result("second") },
      "third",
      result("third"),
      2,
    );

    expect(Object.keys(update.cache)).toEqual(["second", "third"]);
    expect(update.evicted).toEqual([first]);
  });

  it("refreshes a replaced entry as the newest cache item", () => {
    const oldSecond = result("old-second");
    const update = updatePreviewCache(
      { first: result("first"), second: oldSecond },
      "second",
      result("new-second"),
      2,
    );

    expect(Object.keys(update.cache)).toEqual(["first", "second"]);
    expect(update.replaced).toBe(oldSecond);
  });
});
