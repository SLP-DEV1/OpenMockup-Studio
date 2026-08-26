import { describe, expect, it } from "vitest";
import type { MockupSettings } from "../../types";
import { buildAutoPreviewKey } from "./autoPreviewKey";

const settings: MockupSettings = {
  smartObjectName: "Image Canvas",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 0,
  areaTopPercent: 0,
  areaWidthPercent: 100,
  areaHeightPercent: 100,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

describe("buildAutoPreviewKey", () => {
  it("changes when the active design changes", () => {
    const common = {
      mockupId: "mockup-a",
      mockupKind: "image",
      settings,
      exportView: { format: "png" },
    };

    expect(buildAutoPreviewKey({ ...common, designId: "design-a" }))
      .not.toBe(buildAutoPreviewKey({ ...common, designId: "design-b" }));
  });

  it("is stable for the same preview inputs", () => {
    const input = {
      mockupId: "mockup-a",
      designId: "design-a",
      mockupKind: "image",
      settings,
      exportView: { format: "png" },
    };

    expect(buildAutoPreviewKey(input)).toBe(buildAutoPreviewKey(input));
  });
});
