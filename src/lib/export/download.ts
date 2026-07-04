import JSZip from "jszip";
import type { ExportResult, MockupSettings } from "../../types";

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

export async function downloadZip(results: ExportResult[], zipName: string): Promise<void> {
  const zip = new JSZip();

  for (const result of results) {
    zip.file(result.fileName, result.blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}

export function savePreset(settings: MockupSettings): void {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, "openmockup-preset.json");
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
  };
}

export function safeOutputName(inputName: string, index: number): string {
  const stem = inputName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-");
  return `${String(index + 1).padStart(2, "0")}-${stem || "design"}.png`;
}
