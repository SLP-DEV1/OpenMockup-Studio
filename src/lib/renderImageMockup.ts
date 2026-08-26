import { loadImageFromFile } from "./images";
import { drawPerspectiveImage, isValidPerspectiveCorners } from "./perspective";
import { computePlacementMetrics, clamp, type PlacementMetrics } from "./renderPlacement";
import type { MockupSettings } from "../types";

interface ClipContext {
  beginPath(): void;
  rect(x: number, y: number, width: number, height: number): void;
  clip(): void;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not create preview image."));
      else resolve(blob);
    }, "image/png");
  });
}

export function clipCoverPlacement(
  ctx: ClipContext,
  settings: MockupSettings,
  metrics: PlacementMetrics,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  if (settings.fitMode !== "cover") return false;

  const clipX = (metrics.targetLeft / 100) * canvasWidth;
  const clipY = (metrics.targetTop / 100) * canvasHeight;
  const clipW = (metrics.targetWidth / 100) * canvasWidth;
  const clipH = (metrics.targetHeight / 100) * canvasHeight;

  ctx.beginPath();
  ctx.rect(clipX, clipY, clipW, clipH);
  ctx.clip();
  return true;
}

export async function renderImageMockup(mockup: File, design: File, settings: MockupSettings): Promise<Blob> {
  const [mockupImage, designImage] = await Promise.all([
    loadImageFromFile(mockup),
    loadImageFromFile(design),
  ]);

  const width = mockupImage.naturalWidth || mockupImage.width;
  const height = mockupImage.naturalHeight || mockupImage.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create image mockup canvas.");

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(mockupImage, 0, 0, width, height);

  const perspective = settings.perspective;
  if (perspective?.enabled) {
    if (!isValidPerspectiveCorners(perspective.corners)) {
      throw new Error("Perspective corners form an invalid or self-intersecting quadrilateral.");
    }

    ctx.save();
    try {
      ctx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
      if (!drawPerspectiveImage(ctx, designImage, perspective.corners, width, height)) {
        throw new Error("Perspective transform could not be rendered.");
      }
    } finally {
      ctx.restore();
    }
    return canvasToPngBlob(canvas);
  }

  const metrics = computePlacementMetrics(settings, {
    width: designImage.naturalWidth || designImage.width || 1,
    height: designImage.naturalHeight || designImage.height || 1,
  });

  const drawX = (metrics.displayLeft / 100) * width;
  const drawY = (metrics.displayTop / 100) * height;
  const drawW = (metrics.displayWidth / 100) * width;
  const drawH = (metrics.displayHeight / 100) * height;

  ctx.save();
  clipCoverPlacement(ctx, settings, metrics, width, height);
  ctx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
  ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.drawImage(designImage, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvasToPngBlob(canvas);
}
