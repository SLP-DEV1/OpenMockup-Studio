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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvValue(value: string): string {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function collisionKey(path: string): string {
  return path.toLocaleLowerCase("en-US");
}

function appendCollisionSuffix(path: string, suffix: number): string {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const stem = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : "";
  return `${directory}${stem}-${suffix}${extension}`;
}

export function makeUniqueArchivePaths(paths: string[]): string[] {
  const used = new Set<string>();
  const nextSuffix = new Map<string, number>();

  return paths.map((path) => {
    const key = collisionKey(path);
    if (!used.has(key)) {
      used.add(key);
      nextSuffix.set(key, 2);
      return path;
    }

    let suffix = nextSuffix.get(key) ?? 2;
    let candidate = appendCollisionSuffix(path, suffix);
    while (used.has(collisionKey(candidate))) {
      suffix += 1;
      candidate = appendCollisionSuffix(path, suffix);
    }

    nextSuffix.set(key, suffix + 1);
    used.add(collisionKey(candidate));
    return candidate;
  });
}

export async function downloadZip(results: ExportResult[], zipName: string, errors: BatchError[] = []): Promise<void> {
  const zip = new JSZip();
  const archivePaths = makeUniqueArchivePaths(results.map((result) => result.fileName));
  const entries = results.map((result, index) => ({ result, fileName: archivePaths[index] }));

  for (const entry of entries) {
    zip.file(entry.fileName, entry.result.blob);
  }

  if (errors.length > 0) {
    zip.file(
      "_openmockup-errors.txt",
      errors
        .map((error, index) => `${index + 1}. PSD: ${error.mockupName}\nDesign: ${error.designName}\nError: ${error.message}`)
        .join("\n\n"),
    );
  }

  const reportRows = [
    ["type", "file", "mockup", "design", "message"].map(csvValue).join(","),
    ...entries.map((entry) => ["success", entry.fileName, "", "", ""].map(csvValue).join(",")),
    ...errors.map((error) => ["error", "", error.mockupName, error.designName, error.message].map(csvValue).join(",")),
  ];
  zip.file("_openmockup-report.csv", reportRows.join("\n"));

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
