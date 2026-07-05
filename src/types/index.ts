export type FitMode = "contain" | "cover" | "width" | "height";

export type Anchor =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ExportFormat = "png" | "jpg" | "webp";
export type CropPreset = "none" | "square" | "portrait45" | "pinterest23" | "story916";
export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";

export const PHOTOPEA_STEPS = [
  "closeAll",
  "openPsd",
  "openDesign",
  "switchToPsd",
  "findSmartObjectLayer",
  "editSmartObject",
  "placeDesign",
  "saveSmartObject",
  "exportPng",
] as const;

export type PhotopeaStep = (typeof PHOTOPEA_STEPS)[number];

export interface PhotopeaStepInfo {
  step: PhotopeaStep | string;
  label: string;
  startedAt?: number;
  durationMs?: number;
}

export interface MockupSettings {
  smartObjectName: string;
  left: number;
  top: number;
  width: number;
  height: number;
  areaLeftPercent: number;
  areaTopPercent: number;
  areaWidthPercent: number;
  areaHeightPercent: number;
  rotation: number;
  opacity: number;
  fitMode: FitMode;
  anchor: Anchor;
}

export interface SavedPreset {
  id: string;
  name: string;
  settings: MockupSettings;
  updatedAt: number;
}

export interface ProductProfile {
  id: string;
  name: string;
  description: string;
  settings: MockupSettings;
  exportDefaults?: Partial<ExportOptions>;
}

export interface ExportProfile {
  id: string;
  name: string;
  description: string;
  options: Partial<ExportOptions>;
}

export interface ExportOptions {
  filenameTemplate: string;
  zipName: string;
  format: ExportFormat;
  quality: number;
  backgroundColor: string;
  maxLongSide: number;
  cropPreset: CropPreset;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: WatermarkPosition;
}

export interface LoadedAsset {
  id: string;
  file: File;
  url: string;
}

export interface ExportResult {
  fileName: string;
  blob: Blob;
  url: string;
}

export interface BatchError {
  mockupName: string;
  designName: string;
  message: string;
  step?: string;
}

export interface ProgressState {
  current: number;
  total: number;
  label: string;
}

export interface RenderHistoryItem {
  id: string;
  date: string;
  mode: "preview" | "batch";
  mockups: number;
  designs: number;
  exported: number;
  failed: number;
  presetName?: string;
  zipName?: string;
}

export interface DesignWarning {
  fileName: string;
  message: string;
}

export interface DocumentSize {
  width: number;
  height: number;
}
