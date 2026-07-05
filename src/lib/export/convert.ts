import type { ExportOptions } from "../../types";

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not convert exported image."));
    };
    image.src = url;
  });
}

function cropRatio(options: ExportOptions): number | null {
  if (options.cropPreset === "square") return 1;
  if (options.cropPreset === "portrait45") return 4 / 5;
  if (options.cropPreset === "pinterest23") return 2 / 3;
  if (options.cropPreset === "story916") return 9 / 16;
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, options: ExportOptions): Promise<Blob> {
  const mimeType = options.format === "webp" ? "image/webp" : options.format === "jpg" ? "image/jpeg" : "image/png";
  const quality = Math.max(1, Math.min(100, Number(options.quality) || 92)) / 100;

  return new Promise((resolve, reject) => {
    canvas.toBlob((converted) => {
      if (!converted) reject(new Error(`Could not create ${options.format.toUpperCase()} export.`));
      else resolve(converted);
    }, mimeType, options.format === "png" ? undefined : quality);
  });
}

export async function convertExportBlob(blob: Blob, options: ExportOptions): Promise<Blob> {
  const image = await loadImageFromBlob(blob);
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  const ratio = cropRatio(options);

  let cropX = 0;
  let cropY = 0;
  let cropW = sourceW;
  let cropH = sourceH;

  if (ratio) {
    const currentRatio = sourceW / sourceH;
    if (currentRatio > ratio) {
      cropW = Math.round(sourceH * ratio);
      cropX = Math.round((sourceW - cropW) / 2);
    } else {
      cropH = Math.round(sourceW / ratio);
      cropY = Math.round((sourceH - cropH) / 2);
    }
  }

  const maxLongSide = Math.max(0, Number(options.maxLongSide) || 0);
  let outW = cropW;
  let outH = cropH;

  if (maxLongSide > 0 && Math.max(cropW, cropH) > maxLongSide) {
    const scale = maxLongSide / Math.max(cropW, cropH);
    outW = Math.max(1, Math.round(cropW * scale));
    outH = Math.max(1, Math.round(cropH * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not convert export format.");

  if (options.format !== "png") {
    ctx.fillStyle = options.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  const watermark = options.watermarkText.trim();
  if (watermark) {
    const fontSize = Math.max(18, Math.round(outW * 0.035));
    const margin = Math.round(fontSize * 0.8);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(100, options.watermarkOpacity || 18)) / 100;
    ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(watermark);
    let x = outW - margin - metrics.width;
    let y = outH - margin - fontSize / 2;

    if (options.watermarkPosition === "bottom-left") x = margin;
    if (options.watermarkPosition === "top-right") y = margin + fontSize / 2;
    if (options.watermarkPosition === "top-left") {
      x = margin;
      y = margin + fontSize / 2;
    }
    if (options.watermarkPosition === "center") {
      x = (outW - metrics.width) / 2;
      y = outH / 2;
    }

    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.12));
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#111827";
    ctx.strokeText(watermark, x, y);
    ctx.fillText(watermark, x, y);
    ctx.restore();
  }

  return canvasToBlob(canvas, options);
}
