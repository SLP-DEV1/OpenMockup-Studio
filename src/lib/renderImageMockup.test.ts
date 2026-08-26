import { describe, expect, it, vi } from "vitest";
import type { MockupSettings } from "../types";
import { computePlacementMetrics } from "./renderPlacement";
import { clipCoverPlacement } from "./renderImageMockup";

const settings: MockupSettings = {
  smartObjectName: "Image Canvas",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 10,
  areaTopPercent: 20,
  areaWidthPercent: 40,
  areaHeightPercent: 20,
  rotation: 15,
  opacity: 100,
  fitMode: "cover",
  anchor: "center",
};

describe("cover-mode clipping", () => {
  it("clips to the target rectangle before the rotated design is drawn", () => {
    const metrics = computePlacementMetrics(settings, { width: 1000, height: 2000 });
    const ctx = {
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    };

    expect(clipCoverPlacement(ctx, settings, metrics, 1000, 500)).toBe(true);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.rect).toHaveBeenCalledWith(100, 100, 400, 100);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  it("does not clip contain mode", () => {
    const containSettings = { ...settings, fitMode: "contain" as const };
    const metrics = computePlacementMetrics(containSettings, { width: 1000, height: 2000 });
    const ctx = {
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    };

    expect(clipCoverPlacement(ctx, containSettings, metrics, 1000, 500)).toBe(false);
    expect(ctx.rect).not.toHaveBeenCalled();
    expect(ctx.clip).not.toHaveBeenCalled();
  });
});
