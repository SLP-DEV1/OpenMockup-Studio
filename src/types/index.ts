export type FitMode = "contain" | "cover" | "width" | "height";

export type Anchor =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface MockupSettings {
  smartObjectName: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fitMode: FitMode;
  anchor: Anchor;
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

export interface ProgressState {
  current: number;
  total: number;
  label: string;
}
