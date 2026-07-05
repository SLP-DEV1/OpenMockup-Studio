import { loadImageFromFile } from "./images";
import { computePlacementMetrics, clamp } from "./renderPlacement";
import type { MockupSettings } from "../types";

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not create preview image."));
      else resolve(blob);
    }, "image/png");
  });
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

  const metrics = computePlacementMetrics(settings, {
    width: designImage.naturalWidth || designImage.width || 1,
    height: designImage.naturalHeight || designImage.height || 1,
  });

  const drawX = (metrics.displayLeft / 100) * width;
  const drawY = (metrics.displayTop / 100) * height;
  const drawW = (metrics.displayWidth / 100) * width;
  const drawH = (metrics.displayHeight / 100) * height;

  ctx.save();
  ctx.globalAlpha = clamp(settings.opacity, 0, 100) / 100;
  ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.drawImage(designImage, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvasToPngBlob(canvas);
}
