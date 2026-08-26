import { describe, expect, it } from "vitest";
import type { PerspectiveCorners } from "../types";
import {
  homographyFromUnitSquare,
  isValidPerspectiveCorners,
  mapHomographyPoint,
} from "./perspective";

const corners: PerspectiveCorners = {
  topLeft: { x: 10, y: 20 },
  topRight: { x: 80, y: 10 },
  bottomRight: { x: 90, y: 85 },
  bottomLeft: { x: 20, y: 90 },
};

describe("four-corner perspective", () => {
  it("maps all unit-square corners onto the requested quadrilateral", () => {
    const matrix = homographyFromUnitSquare(corners);
    expect(matrix).not.toBeNull();
    if (!matrix) return;

    expect(mapHomographyPoint(matrix, 0, 0)).toEqual(corners.topLeft);
    expect(mapHomographyPoint(matrix, 1, 0).x).toBeCloseTo(corners.topRight.x, 8);
    expect(mapHomographyPoint(matrix, 1, 0).y).toBeCloseTo(corners.topRight.y, 8);
    expect(mapHomographyPoint(matrix, 1, 1).x).toBeCloseTo(corners.bottomRight.x, 8);
    expect(mapHomographyPoint(matrix, 1, 1).y).toBeCloseTo(corners.bottomRight.y, 8);
    expect(mapHomographyPoint(matrix, 0, 1).x).toBeCloseTo(corners.bottomLeft.x, 8);
    expect(mapHomographyPoint(matrix, 0, 1).y).toBeCloseTo(corners.bottomLeft.y, 8);
  });

  it("rejects self-intersecting quadrilaterals", () => {
    expect(isValidPerspectiveCorners({
      topLeft: { x: 10, y: 10 },
      topRight: { x: 90, y: 90 },
      bottomRight: { x: 90, y: 10 },
      bottomLeft: { x: 10, y: 90 },
    })).toBe(false);
  });

  it("rejects near-zero quadrilaterals", () => {
    expect(isValidPerspectiveCorners({
      topLeft: { x: 10, y: 10 },
      topRight: { x: 10.1, y: 10 },
      bottomRight: { x: 10.1, y: 10.1 },
      bottomLeft: { x: 10, y: 10.1 },
    })).toBe(false);
  });
});
