import { describe, expect, it } from "vitest";
import type { MockupSettings } from "../types";
import { clamp, computePlacementMetrics, normalizeAngle } from "./renderPlacement";

const settings: MockupSettings = {
  smartObjectName: "Design",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 10,
  areaTopPercent: 20,
  areaWidthPercent: 40,
  areaHeightPercent: 20,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

describe("render placement", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(clamp(Number.NaN, 2, 8)).toBe(2);
    expect(clamp(-10, 2, 8)).toBe(2);
    expect(clamp(10, 2, 8)).toBe(8);
  });

  it("normalizes angles into the editor range", () => {
    expect(normalizeAngle(540)).toBe(180);
    expect(normalizeAngle(-540)).toBe(-180);
  });

  it("contains and centers a landscape design in the placement area", () => {
    const metrics = computePlacementMetrics(settings, { width: 2000, height: 1000 });

    expect(metrics.displayWidth).toBe(40);
    expect(metrics.displayHeight).toBe(20);
    expect(metrics.displayLeft).toBe(10);
    expect(metrics.displayTop).toBe(20);
  });

  it("honors a top-right anchor in cover mode", () => {
    const metrics = computePlacementMetrics(
      { ...settings, fitMode: "cover", anchor: "top-right" },
      { width: 1000, height: 2000 },
    );

    expect(metrics.displayWidth).toBe(40);
    expect(metrics.displayHeight).toBe(80);
    expect(metrics.displayLeft).toBe(10);
    expect(metrics.displayTop).toBe(20);
  });
});
