import type { Anchor, FitMode, MockupSettings } from "../types";

export interface SizeLike {
  width: number;
  height: number;
}

export interface PlacementMetrics {
  areaLeft: number;
  areaTop: number;
  areaWidth: number;
  areaHeight: number;
  targetLeft: number;
  targetTop: number;
  targetWidth: number;
  targetHeight: number;
  displayLeft: number;
  displayTop: number;
  displayWidth: number;
  displayHeight: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(value: number): number {
  let angle = value;
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

export function angleFrom(centerX: number, centerY: number, x: number, y: number): number {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}

export function computePlacementMetrics(settings: MockupSettings, designSize: SizeLike | null): PlacementMetrics {
  const areaLeft = clamp(settings.areaLeftPercent, 0, 100);
  const areaTop = clamp(settings.areaTopPercent, 0, 100);
  const areaWidth = clamp(settings.areaWidthPercent, 1, Math.max(1, 100 - areaLeft));
  const areaHeight = clamp(settings.areaHeightPercent, 1, Math.max(1, 100 - areaTop));
  const left = clamp(settings.left, -500, 500);
  const top = clamp(settings.top, -500, 500);
  const width = clamp(settings.width, 1, 500);
  const height = clamp(settings.height, 1, 500);

  const targetLeft = areaLeft + (areaWidth * left) / 100;
  const targetTop = areaTop + (areaHeight * top) / 100;
  const targetWidth = Math.max(0.5, (areaWidth * width) / 100);
  const targetHeight = Math.max(0.5, (areaHeight * height) / 100);

  const naturalW = Math.max(1, designSize?.width || 1);
  const naturalH = Math.max(1, designSize?.height || 1);

  let scale = computeScale(settings.fitMode, targetWidth, targetHeight, naturalW, naturalH);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  const scaledWidth = naturalW * scale;
  const scaledHeight = naturalH * scale;

  const anchored = anchorPosition(settings.anchor, targetLeft, targetTop, targetWidth, targetHeight, scaledWidth, scaledHeight);

  return {
    areaLeft,
    areaTop,
    areaWidth,
    areaHeight,
    targetLeft,
    targetTop,
    targetWidth,
    targetHeight,
    displayLeft: anchored.left,
    displayTop: anchored.top,
    displayWidth: scaledWidth,
    displayHeight: scaledHeight,
  };
}

function computeScale(fitMode: FitMode, targetWidth: number, targetHeight: number, naturalW: number, naturalH: number): number {
  if (fitMode === "width") return targetWidth / naturalW;
  if (fitMode === "height") return targetHeight / naturalH;
  if (fitMode === "cover") return Math.max(targetWidth / naturalW, targetHeight / naturalH);
  return Math.min(targetWidth / naturalW, targetHeight / naturalH);
}

function anchorPosition(anchor: Anchor, targetLeft: number, targetTop: number, targetWidth: number, targetHeight: number, scaledWidth: number, scaledHeight: number) {
  let left = targetLeft + (targetWidth - scaledWidth) / 2;
  let top = targetTop + (targetHeight - scaledHeight) / 2;

  switch (anchor) {
    case "top-left":
      left = targetLeft;
      top = targetTop;
      break;
    case "top-right":
      left = targetLeft + targetWidth - scaledWidth;
      top = targetTop;
      break;
    case "bottom-left":
      left = targetLeft;
      top = targetTop + targetHeight - scaledHeight;
      break;
    case "bottom-right":
      left = targetLeft + targetWidth - scaledWidth;
      top = targetTop + targetHeight - scaledHeight;
      break;
    default:
      break;
  }

  return { left, top };
}
