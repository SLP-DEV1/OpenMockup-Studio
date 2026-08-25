import type { DesignWarning, DocumentSize, ExportOptions, ExportResult, LoadedAsset, MockupSettings } from "../../types";
import { shirtPlacementDefaults } from "../config/defaults";
import { detectProductProfileIdFromMockupName, findProductProfileById, isMugProductProfileId, productProfiles } from "../config/profiles";
import { getImageDimensions } from "../images";
import { detectSmartObjectNameFromPsd, type SmartObjectBounds, type SmartObjectCandidate } from "../psdSmartObjectDetection";

export type MockupKind = "psd" | "image" | "unknown";

export const defaultSettings: MockupSettings = {
  smartObjectName: "Auto-detect",
  ...shirtPlacementDefaults,
};

export const defaultExportOptions: ExportOptions = {
  filenameTemplate: "{index}-{mockup}-{design}.{ext}",
  zipName: "openmockup-export.zip",
  format: "png",
  quality: 92,
  backgroundColor: "#ffffff",
  maxLongSide: 0,
  cropPreset: "none",
  watermarkText: "",
  watermarkOpacity: 18,
  watermarkPosition: "bottom-right",
};

const imagePlacementDefaults: Partial<MockupSettings> = {
  smartObjectName: "Image Canvas",
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  areaLeftPercent: 0,
  areaTopPercent: 0,
  areaWidthPercent: 100,
  areaHeightPercent: 100,
  rotation: 0,
  opacity: 100,
  fitMode: "contain",
  anchor: "center",
};

export interface MockupMeta {
  kind: MockupKind;
  documentSize: DocumentSize;
  smartObjectCandidates: SmartObjectCandidate[];
  smartObjectDetectionLabel: string;
  productProfileId: string;
  smartObjectBounds?: SmartObjectBounds;
}

export const fallbackDocumentSize: DocumentSize = { width: 3000, height: 2000 };

export function detectMockupKind(file?: File | null): MockupKind {
  if (!file) return "unknown";
  const name = file.name.toLowerCase();
  if (name.endsWith(".psd")) return "psd";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  return "unknown";
}

export function makeAsset(file: File): LoadedAsset {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    url: URL.createObjectURL(file),
  };
}

export function revokeAssetUrls(assets: LoadedAsset[]): void {
  assets.forEach((asset) => URL.revokeObjectURL(asset.url));
}

export function revokeResultUrls(results: ExportResult[]): void {
  results.forEach((result) => URL.revokeObjectURL(result.url));
}

export function buildDesignWarnings(
  dimensions: Record<string, { width: number; height: number }>,
  designs: LoadedAsset[],
): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  for (const design of designs) {
    const dim = dimensions[design.id];
    if (!dim) continue;
    if (dim.width < 800 || dim.height < 800) {
      warnings.push({ fileName: design.file.name, message: `Low resolution ${dim.width}×${dim.height}. Large mockups may look soft.` });
    }
    if (design.file.type === "image/jpeg" && design.file.size > 6_000_000) {
      warnings.push({ fileName: design.file.name, message: "Large JPG file. PNG with transparency usually works better for print designs." });
    }
  }
  return warnings;
}

export function getLockedSmartSlotFromBounds(
  bounds: SmartObjectBounds | undefined,
  docSize: DocumentSize,
): Partial<MockupSettings> | null {
  if (!bounds || docSize.width <= 0 || docSize.height <= 0) return null;
  const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
  const areaLeftPercent = clamp((bounds.left / docSize.width) * 100, 0, 100);
  const areaTopPercent = clamp((bounds.top / docSize.height) * 100, 0, 100);
  const areaWidthPercent = clamp((bounds.width / docSize.width) * 100, 1, 100 - areaLeftPercent || 1);
  const areaHeightPercent = clamp((bounds.height / docSize.height) * 100, 1, 100 - areaTopPercent || 1);
  return {
    areaLeftPercent: Number(areaLeftPercent.toFixed(2)),
    areaTopPercent: Number(areaTopPercent.toFixed(2)),
    areaWidthPercent: Number(areaWidthPercent.toFixed(2)),
    areaHeightPercent: Number(areaHeightPercent.toFixed(2)),
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    anchor: "center",
  };
}

export function getImageModeSettings(autoProductProfile?: (typeof productProfiles)[number]): MockupSettings {
  return {
    ...defaultSettings,
    ...(autoProductProfile?.settings ?? {}),
    ...imagePlacementDefaults,
    smartObjectName: autoProductProfile ? `${autoProductProfile.name} Image Area` : "Image Canvas",
  };
}

async function readPsdDimensionsFromFile(file: File): Promise<DocumentSize | null> {
  try {
    const header = await file.slice(0, 26).arrayBuffer();
    if (header.byteLength < 26) return null;
    const view = new DataView(header);
    const signature = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const version = view.getUint16(4, false);
    if (signature !== "8BPS" || (version !== 1 && version !== 2)) return null;
    const height = view.getUint32(14, false);
    const width = view.getUint32(18, false);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { width, height };
  } catch {
    return null;
  }
}

function getProductProfileForMockup(file: File): (typeof productProfiles)[number] | undefined {
  return findProductProfileById(detectProductProfileIdFromMockupName(file.name));
}

export async function analyseMockupAsset(
  asset: LoadedAsset,
): Promise<{ meta: MockupMeta; settings: MockupSettings; status: string }> {
  const file = asset.file;
  const productProfile = getProductProfileForMockup(file);
  const kind = detectMockupKind(file);

  if (kind === "image") {
    const documentSize = await getImageDimensions(file).catch(() => fallbackDocumentSize);
    const settings = getImageModeSettings(productProfile);
    return {
      meta: {
        kind,
        documentSize,
        smartObjectCandidates: [],
        smartObjectBounds: undefined,
        productProfileId: productProfile?.id || "tshirt-front",
        smartObjectDetectionLabel: productProfile
          ? `Image mockup mode active. ${productProfile.name} was auto-detected from the filename. The design is rendered directly on the PNG/JPG mockup.`
          : "Image mockup mode active. No PSD SmartObject is needed. The design is rendered directly on the PNG/JPG mockup.",
      },
      settings,
      status: productProfile
        ? `Image mockup loaded: ${file.name} · profile ${productProfile.name} active`
        : `Image mockup loaded: ${file.name}`,
    };
  }

  if (kind === "psd") {
    const documentSize = (await readPsdDimensionsFromFile(file)) || fallbackDocumentSize;
    const detection = await detectSmartObjectNameFromPsd(file);
    const lockedSlot = getLockedSmartSlotFromBounds(detection.selectedBounds, documentSize);
    const settings: MockupSettings = {
      ...(productProfile?.settings ?? defaultSettings),
      ...(lockedSlot ?? {}),
      smartObjectName: detection.detectedName,
    };
    const smartObjectDetectionLabel = detection.candidates.length
      ? lockedSlot
        ? `Auto-detected: ${detection.detectedName} · locked smart slot ${Math.round(detection.selectedBounds?.width || 0)}×${Math.round(detection.selectedBounds?.height || 0)} px`
        : `Auto-detected: ${detection.detectedName} (${detection.reason})`
      : `Auto-detect fallback: ${detection.reason}. The stable renderer will use Photopea's initially active layer.`;

    return {
      meta: {
        kind,
        documentSize,
        smartObjectCandidates: detection.candidates,
        smartObjectBounds: detection.selectedBounds,
        productProfileId: productProfile?.id || "tshirt-front",
        smartObjectDetectionLabel,
      },
      settings,
      status: productProfile
        ? isMugProductProfileId(productProfile.id)
          ? `Auto product profile loaded: ${productProfile.name} · mug auto-center active`
          : `Auto product profile loaded: ${productProfile.name}`
        : lockedSlot
          ? `SmartObject slot detected automatically: ${Math.round(detection.selectedBounds?.width || 0)}×${Math.round(detection.selectedBounds?.height || 0)} px.`
          : `PSD mockup loaded: ${file.name}`,
    };
  }

  return {
    meta: {
      kind: "unknown",
      documentSize: fallbackDocumentSize,
      smartObjectCandidates: [],
      smartObjectBounds: undefined,
      productProfileId: productProfile?.id || "tshirt-front",
      smartObjectDetectionLabel: "Unsupported mockup type. Use PSD, PNG, JPG or WebP.",
    },
    settings: productProfile?.settings ?? defaultSettings,
    status: `Unsupported mockup type: ${file.name}`,
  };
}
