import type { PerspectiveCorners, PerspectivePoint } from "../types";
import type { PlacementMetrics } from "./renderPlacement";

export type PerspectiveCornerName = keyof PerspectiveCorners;

interface Homography {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

function cross(a: PerspectivePoint, b: PerspectivePoint, c: PerspectivePoint): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

export function isValidPerspectiveCorners(corners: PerspectiveCorners): boolean {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;

  const signedArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  if (Math.abs(signedArea) < 1) return false;

  const turns = [
    cross(points[0], points[1], points[2]),
    cross(points[1], points[2], points[3]),
    cross(points[2], points[3], points[0]),
    cross(points[3], points[0], points[1]),
  ];
  const positive = turns.every((value) => value > 0.01);
  const negative = turns.every((value) => value < -0.01);
  return positive || negative;
}

export function clampPerspectivePoint(point: PerspectivePoint): PerspectivePoint {
  return {
    x: Math.max(0, Math.min(100, point.x)),
    y: Math.max(0, Math.min(100, point.y)),
  };
}

export function perspectiveCornersFromMetrics(metrics: PlacementMetrics): PerspectiveCorners {
  const left = metrics.targetLeft;
  const top = metrics.targetTop;
  const right = metrics.targetLeft + metrics.targetWidth;
  const bottom = metrics.targetTop + metrics.targetHeight;
  return {
    topLeft: { x: left, y: top },
    topRight: { x: right, y: top },
    bottomRight: { x: right, y: bottom },
    bottomLeft: { x: left, y: bottom },
  };
}

export function homographyFromUnitSquare(corners: PerspectiveCorners): Homography | null {
  if (!isValidPerspectiveCorners(corners)) return null;

  const x0 = corners.topLeft.x;
  const y0 = corners.topLeft.y;
  const x1 = corners.topRight.x;
  const y1 = corners.topRight.y;
  const x2 = corners.bottomRight.x;
  const y2 = corners.bottomRight.y;
  const x3 = corners.bottomLeft.x;
  const y3 = corners.bottomLeft.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return {
      a: x1 - x0,
      b: x3 - x0,
      c: x0,
      d: y1 - y0,
      e: y3 - y0,
      f: y0,
      g: 0,
      h: 0,
    };
  }

  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-9) return null;

  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;

  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

export function mapHomographyPoint(matrix: Homography, u: number, v: number): PerspectivePoint {
  const denominator = matrix.g * u + matrix.h * v + 1;
  return {
    x: (matrix.a * u + matrix.b * v + matrix.c) / denominator,
    y: (matrix.d * u + matrix.e * v + matrix.f) / denominator,
  };
}

function drawImageTriangle(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: [PerspectivePoint, PerspectivePoint, PerspectivePoint],
  destination: [PerspectivePoint, PerspectivePoint, PerspectivePoint],
): void {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 1e-9) return;

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const e = (
    d0.x * (s1.x * s2.y - s2.x * s1.y) +
    d1.x * (s2.x * s0.y - s0.x * s2.y) +
    d2.x * (s0.x * s1.y - s1.x * s0.y)
  ) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const f = (
    d0.y * (s1.x * s2.y - s2.x * s1.y) +
    d1.y * (s2.x * s0.y - s0.x * s2.y) +
    d2.y * (s0.x * s1.y - s1.x * s0.y)
  ) / denominator;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

export function drawPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cornersPercent: PerspectiveCorners,
  canvasWidth: number,
  canvasHeight: number,
  subdivisions = 10,
): boolean {
  if (!isValidPerspectiveCorners(cornersPercent)) return false;

  const corners: PerspectiveCorners = {
    topLeft: { x: (cornersPercent.topLeft.x / 100) * canvasWidth, y: (cornersPercent.topLeft.y / 100) * canvasHeight },
    topRight: { x: (cornersPercent.topRight.x / 100) * canvasWidth, y: (cornersPercent.topRight.y / 100) * canvasHeight },
    bottomRight: { x: (cornersPercent.bottomRight.x / 100) * canvasWidth, y: (cornersPercent.bottomRight.y / 100) * canvasHeight },
    bottomLeft: { x: (cornersPercent.bottomLeft.x / 100) * canvasWidth, y: (cornersPercent.bottomLeft.y / 100) * canvasHeight },
  };
  const matrix = homographyFromUnitSquare(corners);
  if (!matrix) return false;

  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const steps = Math.max(2, Math.min(24, Math.round(subdivisions)));

  for (let row = 0; row < steps; row += 1) {
    const v0 = row / steps;
    const v1 = (row + 1) / steps;
    for (let column = 0; column < steps; column += 1) {
      const u0 = column / steps;
      const u1 = (column + 1) / steps;

      const s00 = { x: u0 * sourceWidth, y: v0 * sourceHeight };
      const s10 = { x: u1 * sourceWidth, y: v0 * sourceHeight };
      const s11 = { x: u1 * sourceWidth, y: v1 * sourceHeight };
      const s01 = { x: u0 * sourceWidth, y: v1 * sourceHeight };
      const d00 = mapHomographyPoint(matrix, u0, v0);
      const d10 = mapHomographyPoint(matrix, u1, v0);
      const d11 = mapHomographyPoint(matrix, u1, v1);
      const d01 = mapHomographyPoint(matrix, u0, v1);

      drawImageTriangle(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      drawImageTriangle(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }

  return true;
}
