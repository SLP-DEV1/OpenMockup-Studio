import { describe, expect, it } from "vitest";
import { detectMockupKind, getLockedSmartSlotFromBounds } from "./mockups";

describe("mockup model", () => {
  it("detects supported mockup file types", () => {
    expect(detectMockupKind(new File([], "shirt.PSD"))).toBe("psd");
    expect(detectMockupKind(new File([], "shirt.png", { type: "image/png" }))).toBe("image");
    expect(detectMockupKind(new File([], "notes.txt", { type: "text/plain" }))).toBe("unknown");
  });

  it("converts Smart Object bounds to percentage placement", () => {
    const placement = getLockedSmartSlotFromBounds(
      { left: 300, top: 200, right: 900, bottom: 600, width: 600, height: 400 },
      { width: 3000, height: 2000 },
    );

    expect(placement).toMatchObject({
      areaLeftPercent: 10,
      areaTopPercent: 10,
      areaWidthPercent: 20,
      areaHeightPercent: 20,
      width: 100,
      height: 100,
    });
  });
});
