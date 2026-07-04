import JSZip from "jszip";
import type { BatchError, ExportResult, MockupSettings } from "../../types";

export interface FileNameContext {
  designName: string;
  mockupName: string;
  index: number;
  presetName?: string;
  format?: string;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadZip(results: ExportResult[], zipName: string, errors: BatchError[] = []): Promise<void> {
  const zip = new JSZip();

  for (const result of results) {
    zip.file(result.fileName, result.blob);
  }

  if (errors.length > 0) {
    zip.file(
      "_openmockup-errors.txt",
      errors
        .map((error, index) => `${index + 1}. PSD: ${error.mockupName}\nDesign: ${error.designName}\nError: ${error.message}`)
        .join("\n\n"),
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}

export function savePreset(settings: MockupSettings, name = "openmockup-preset"): void {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${slugify(name) || "openmockup-preset"}.json`);
}

export async function readPreset(file: File): Promise<MockupSettings> {
  const text = await file.text();
  const value = JSON.parse(text) as MockupSettings;

  if (!value.smartObjectName || typeof value.left !== "number") {
    throw new Error("Preset is invalid or incomplete.");
  }

  return {
    ...value,
    areaLeftPercent: typeof value.areaLeftPercent === "number" ? value.areaLeftPercent : 38,
    areaTopPercent: typeof value.areaTopPercent === "number" ? value.areaTopPercent : 25,
    areaWidthPercent: typeof value.areaWidthPercent === "number" ? value.areaWidthPercent : 24,
    areaHeightPercent: typeof value.areaHeightPercent === "number" ? value.areaHeightPercent : 32,
    rotation: typeof value.rotation === "number" ? value.rotation : 0,
    opacity: typeof value.opacity === "number" ? value.opacity : 100,
    fitMode: value.fitMode ?? "contain",
    anchor: value.anchor ?? "center",
  };
}

export function slugify(value: string): string {
  return (value || "")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

export function renderFileName(template: string, context: FileNameContext): string {
  const date = new Date().toISOString().slice(0, 10);
  const design = slugify(context.designName) || "design";
  const mockup = slugify(context.mockupName) || "mockup";
  const preset = slugify(context.presetName || "preset") || "preset";
  const index = String(context.index + 1).padStart(3, "0");
  const extension = context.format || "png";

  const rendered = (template || "{index}-{mockup}-{design}.{ext}")
    .replace(/\{design\}/g, design)
    .replace(/\{mockup\}/g, mockup)
    .replace(/\{preset\}/g, preset)
    .replace(/\{index\}/g, index)
    .replace(/\{date\}/g, date)
    .replace(/\{ext\}/g, extension);

  const fallback = `${index}-${mockup}-${design}.${extension}`;
  const safe = rendered
    .split("/")
    .map((part) => slugify(part.replace(/\.(png|jpe?g|webp)$/i, "")) || "file")
    .join("/");

  return ensureExtension(safe || fallback, extension);
}

export function safeOutputName(inputName: string, index: number, format = "png"): string {
  return renderFileName("{index}-{design}.{ext}", {
    designName: inputName,
    mockupName: "mockup",
    index,
    format,
  });
}

function ensureExtension(fileName: string, extension: string): string {
  const normalizedExt = extension === "jpg" ? "jpg" : extension;
  const withoutExt = fileName.replace(/\.(png|jpe?g|webp)$/i, "");
  return `${withoutExt}.${normalizedExt}`;
}
