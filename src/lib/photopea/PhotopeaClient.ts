import {
  buildOpenAsSmartInPsdScript,
  buildPreviewCleanupAndSelectScript,
  markPsdScript,
  stabilizeAfterSaveScript,
  closeAllDocumentsScript,
  exportPngScript
} from "./scripts";
import type { MockupSettings, PhotopeaStepInfo } from "../../types";

interface NormalizedMockupSettings {
  smartObjectName: string;
  left: number;
  top: number;
  width: number;
  height: number;
  placementX: number;
  placementY: number;
  placementW: number;
  placementH: number;
  rotation: number;
  opacity: number;
  fitMode: MockupSettings["fitMode"];
  anchor: MockupSettings["anchor"];
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSettings(settings: MockupSettings): NormalizedMockupSettings {
  const raw = settings as MockupSettings & {
    placementX?: number;
    placementY?: number;
    placementW?: number;
    placementH?: number;
  };

  return {
    smartObjectName: settings.smartObjectName ?? "YouR Logo hERE",
    left: numberOrDefault(settings.left, 0),
    top: numberOrDefault(settings.top, 0),
    width: numberOrDefault(settings.width, 100),
    height: numberOrDefault(settings.height, 100),
    placementX: numberOrDefault(raw.placementX ?? settings.areaLeftPercent, 38),
    placementY: numberOrDefault(raw.placementY ?? settings.areaTopPercent, 25),
    placementW: numberOrDefault(raw.placementW ?? settings.areaWidthPercent, 24),
    placementH: numberOrDefault(raw.placementH ?? settings.areaHeightPercent, 32),
    rotation: numberOrDefault(settings.rotation, 0),
    opacity: numberOrDefault(settings.opacity, 100),
    fitMode: settings.fitMode ?? "contain",
    anchor: settings.anchor ?? "center",
  };
}

function psdCacheKey(psd: File): string {
  return `${psd.name}:${psd.size}:${psd.lastModified}`;
}

type PsdDimensions = { width: number; height: number };

async function readPsdDimensionsFromFile(file: File): Promise<PsdDimensions | null> {
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


interface BrowserPlacedDesignDetails {
  areaX: number;
  areaY: number;
  areaW: number;
  areaH: number;
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  finalX: number;
  finalY: number;
  scaledW: number;
  scaledH: number;
  rotation: number;
  opacity: number;
  fitMode: string;
  anchor: string;
}

function clampNumber(value: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not render transformed design from ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToPngFile(canvas: HTMLCanvasElement, originalFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create transformed design PNG."));
        return;
      }
      const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "design";
      resolve(new File([blob], `${baseName}.openmockup-placed.png`, { type: "image/png", lastModified: Date.now() }));
    }, "image/png");
  });
}

function computeBrowserPlacement(
  settings: NormalizedMockupSettings,
  docWidth: number,
  docHeight: number,
  designWidth: number,
  designHeight: number,
): BrowserPlacedDesignDetails {
  const safeDocW = Math.max(1, Math.round(docWidth || 3000));
  const safeDocH = Math.max(1, Math.round(docHeight || 2000));
  const safeDesignW = Math.max(1, designWidth || 1);
  const safeDesignH = Math.max(1, designHeight || 1);

  const left = clampNumber(settings.left, -500, 500);
  const top = clampNumber(settings.top, -500, 500);
  const width = clampNumber(settings.width, 1, 500);
  const height = clampNumber(settings.height, 1, 500);
  const opacity = clampNumber(settings.opacity, 0, 100);
  const rotation = Number.isFinite(settings.rotation) ? settings.rotation : 0;

  let placementX = clampNumber(settings.placementX, 0, 100);
  let placementY = clampNumber(settings.placementY, 0, 100);
  let placementW = clampNumber(settings.placementW, 1, 100);
  let placementH = clampNumber(settings.placementH, 1, 100);

  if (placementX + placementW > 100) placementW = Math.max(1, 100 - placementX);
  if (placementY + placementH > 100) placementH = Math.max(1, 100 - placementY);

  const areaX = safeDocW * placementX / 100;
  const areaY = safeDocH * placementY / 100;
  const areaW = safeDocW * placementW / 100;
  const areaH = safeDocH * placementH / 100;

  const targetX = areaX + areaW * left / 100;
  const targetY = areaY + areaH * top / 100;
  const targetW = Math.max(1, areaW * width / 100);
  const targetH = Math.max(1, areaH * height / 100);

  let scale = 1;
  if (settings.fitMode === "width") scale = targetW / safeDesignW;
  else if (settings.fitMode === "height") scale = targetH / safeDesignH;
  else if (settings.fitMode === "cover") scale = Math.max(targetW / safeDesignW, targetH / safeDesignH);
  else scale = Math.min(targetW / safeDesignW, targetH / safeDesignH);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  const scaledW = safeDesignW * scale;
  const scaledH = safeDesignH * scale;

  let finalX = targetX + (targetW - scaledW) / 2;
  let finalY = targetY + (targetH - scaledH) / 2;

  switch (settings.anchor) {
    case "top-left":
      finalX = targetX;
      finalY = targetY;
      break;
    case "top-right":
      finalX = targetX + targetW - scaledW;
      finalY = targetY;
      break;
    case "bottom-left":
      finalX = targetX;
      finalY = targetY + targetH - scaledH;
      break;
    case "bottom-right":
      finalX = targetX + targetW - scaledW;
      finalY = targetY + targetH - scaledH;
      break;
    case "center":
    default:
      break;
  }

  return {
    areaX, areaY, areaW, areaH,
    targetX, targetY, targetW, targetH,
    finalX, finalY, scaledW, scaledH,
    rotation,
    opacity,
    fitMode: settings.fitMode,
    anchor: settings.anchor,
  };
}

async function createBrowserPlacedDesignFile(
  design: File,
  settings: NormalizedMockupSettings,
  docWidth: number,
  docHeight: number,
  designWidth?: number,
  designHeight?: number,
): Promise<{ file: File; details: BrowserPlacedDesignDetails }> {
  const image = await loadImageElement(design);
  const naturalW = Math.max(1, designWidth || image.naturalWidth || image.width || 1);
  const naturalH = Math.max(1, designHeight || image.naturalHeight || image.height || 1);
  const safeDocW = Math.max(1, Math.round(docWidth || 3000));
  const safeDocH = Math.max(1, Math.round(docHeight || 2000));
  const details = computeBrowserPlacement(settings, safeDocW, safeDocH, naturalW, naturalH);

  const canvas = document.createElement("canvas");
  canvas.width = safeDocW;
  canvas.height = safeDocH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create placement canvas.");

  ctx.clearRect(0, 0, safeDocW, safeDocH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.globalAlpha = clampNumber(details.opacity, 0, 100) / 100;

  if (details.fitMode === "cover") {
    ctx.beginPath();
    ctx.rect(details.targetX, details.targetY, details.targetW, details.targetH);
    ctx.clip();
  }

  const centerX = details.finalX + details.scaledW / 2;
  const centerY = details.finalY + details.scaledH / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate(details.rotation * Math.PI / 180);
  ctx.drawImage(image, -details.scaledW / 2, -details.scaledH / 2, details.scaledW, details.scaledH);
  ctx.restore();

  const file = await canvasToPngFile(canvas, design);
  return { file, details };
}

const PHOTOPEA_URL = "https://www.photopea.com#";
const ACTION_TIMEOUT_SCRIPT_MS = 120_000;
const ACTION_TIMEOUT_FILE_MS = 300_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function formatSeconds(timeoutMs: number): number {
  return Math.round(timeoutMs / 1000);
}

function describeExpectedMarker(marker?: string): string {
  if (!marker) return "script";
  const match = marker.match(/^STEP:([^:]+)/);
  return match?.[1] ?? "script";
}

async function uploadDesignFile(file: File): Promise<string> {
  const response = await fetch("/__openmockup/design", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Could not prepare design URL: ${response.status}`);
  }

  const value = (await response.json()) as { url?: string };
  if (!value.url) {
    throw new Error("Could not prepare design URL.");
  }

  const designUrl = new URL(value.url, window.location.origin);
  if (designUrl.protocol !== "https:" || LOOPBACK_HOSTS.has(designUrl.hostname)) {
    throw new Error(
      "Photopea needs a public HTTPS design URL for the design asset. Run `npm run dev:public` " +
        "and open the shown trycloudflare.com URL, or set OPENMOCKUP_PUBLIC_BASE_URL to your public HTTPS tunnel URL.",
    );
  }

  return designUrl.href;
}

async function verifyDesignUrlForPhotopea(designUrl: string): Promise<void> {
  const response = await fetch(designUrl, { method: "GET", cache: "no-store", mode: "cors" });
  if (!response.ok) {
    throw new Error(`Design URL is not reachable for Photopea: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  const blob = await response.blob();
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Design URL did not return an image. Content-Type: ${contentType || "missing"}`);
  }
  if (blob.size <= 0) {
    throw new Error("Design URL returned an empty file.");
  }

  console.log(`[OpenMockup] verified public design URL (${contentType}, ${(blob.size / 1024).toFixed(1)} KB): ${designUrl}`);
}

type PendingAction = {
  resolve: (value: ArrayBuffer | string) => void;
  reject: (reason?: unknown) => void;
  binaryExpected: boolean;
  timer: number;
  exportBuffer?: ArrayBuffer | null;
  expectedMarker?: string;
  expectedMarkerSeen?: boolean;
  stepMessages: string[];
};

export type StepCallback = (info: PhotopeaStepInfo) => void;

const DEFAULT_STEP_CALLBACK: StepCallback = (info) => {
  if (info.startedAt && !info.durationMs) {
    console.log(`[Photopea] start ${info.step} - ${info.label}`);
  } else if (info.durationMs !== undefined) {
    console.log(`[Photopea] done ${info.step} - ${info.label} (${info.durationMs}ms)`);
  }
};

export class PhotopeaClient {
  private iframe: HTMLIFrameElement;
  private pending: PendingAction | null = null;
  private readyPromise: Promise<void>;
  private readyResolver!: () => void;
  private isReady = false;
  private stepCallback: StepCallback;
  private fatalError: Error | null = null;
  private lastStepMessages: string[] = [];
  private loadedPsdKey: string | null = null;
  private loadedPsdSize: { width: number; height: number } | null = null;

  constructor(iframe: HTMLIFrameElement, onStep?: StepCallback) {
    console.log("[OpenMockup] PhotopeaClient created");
    this.iframe = iframe;
    this.stepCallback = onStep ?? DEFAULT_STEP_CALLBACK;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolver = resolve;
    });
    window.addEventListener("message", this.handleMessage);
    this.iframe.src = PHOTOPEA_URL;
  }

  destroy(): void {
    window.removeEventListener("message", this.handleMessage);
    this.rejectPending(new Error("Photopea connection was closed."));
    this.loadedPsdKey = null;
    this.loadedPsdSize = null;
  }

  resetPsdCache(): void {
    this.loadedPsdKey = null;
    this.loadedPsdSize = null;
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  // ------------------------------------------------------------------
  // Zentrale Step-Funktion: loggt, timedet, und zeigt den Fortschritt
  // ------------------------------------------------------------------
  private runPhotopeaStep<T>(stepName: string, label: string, timeoutMs: number, action: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    this.stepCallback({ step: stepName, label, startedAt });
    return action().then(
      (result) => {
        if (this.fatalError) throw this.fatalError;
        const durationMs = Date.now() - startedAt;
        this.stepCallback({ step: stepName, label, startedAt, durationMs });
        return result;
      },
      (error) => {
        const durationMs = Date.now() - startedAt;
        const timeoutError = error instanceof Error && error.message.includes("took too long");
        if (timeoutError) {
          this.stepCallback({ step: stepName, label, startedAt, durationMs });
          throw new Error(
            `Photopea stopped responding during "${label}" after ${Math.round(durationMs / 1000)}s ` +
              `(limit: ${formatSeconds(timeoutMs)}s). This usually means Photopea hit an internal PSD parsing issue. ` +
              `Try rasterizing unsupported text layers or simplifying the PSD, then run the preview again.`,
          );
        }
        throw error;
      },
    );
  }

  async renderMockup(psd: File, design: File, settings: MockupSettings, designWidth?: number, designHeight?: number): Promise<Blob> {
    await this.waitUntilReady();
    this.fatalError = null;

    console.log(`[Photopea] renderMockup: PSD="${psd.name}", Design="${design.name}"${designWidth ? `, designSize=${designWidth}x${designHeight}` : ""}`);
    console.log("[OpenMockup] render settings:", settings);
    const normalizedSettings = normalizeSettings(settings);
    console.log("[OpenMockup] normalized settings:", normalizedSettings);
    const currentPsdKey = psdCacheKey(psd);
    console.log("[OpenMockup] psdKey current:", currentPsdKey);
    console.log("[OpenMockup] loadedPsdKey:", this.loadedPsdKey);

    // Stable MVP mode: always reload the PSD for each render.
    // Reusing Photopea documents caused nested-layer selection and cleanup issues.
    const cacheMissReason = "cacheDisabledStableMvp";
    const canReusePsd = false;

    let docWidth = this.loadedPsdSize?.width ?? 0;
    let docHeight = this.loadedPsdSize?.height ?? 0;

    if (!canReusePsd) {
      this.loadedPsdKey = null;
      this.loadedPsdSize = null;

      await this.runPhotopeaStep(
        "psdCache",
        "Loading PSD into Photopea",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.echoStep(`STEP:psdCache:load:reason=${cacheMissReason || "forcedReset"}`),
      );

      await this.runPhotopeaStep(
        "closeAll",
        "Closing all documents",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.closeAllDocuments(),
      );

      await this.runPhotopeaStep(
        "openPsd",
        `Opening PSD: ${psd.name}`,
        ACTION_TIMEOUT_FILE_MS,
        () => this.openFile(psd),
      );

      await this.runPhotopeaStep(
        "markPsd",
        "Marking PSD document",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.runScript(markPsdScript, "STEP:mark:psd:done"),
      );

      const parsedPsdSize = await readPsdDimensionsFromFile(psd);
      if (parsedPsdSize) {
        docWidth = parsedPsdSize.width;
        docHeight = parsedPsdSize.height;
        console.log(`[OpenMockup] PSD file header size: ${docWidth}x${docHeight}`);
      } else {
        // Safe fallback: avoids Photopea DOM doc.width/doc.height crashes on some PSDs.
        docWidth = 3000;
        docHeight = 2000;
        console.warn("[OpenMockup] Could not read PSD header size. Falling back to 3000x2000.");
      }

      await this.runPhotopeaStep(
        "readDocSize",
        "Reading PSD document size from PSD header",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.echoStep(`STEP:readDocSize:${docWidth}x${docHeight}`),
      );

      this.loadedPsdKey = currentPsdKey;
      this.loadedPsdSize = { width: docWidth, height: docHeight };
      console.log("[OpenMockup] loadedPsdKey set:", this.loadedPsdKey);
      await this.runPhotopeaStep(
        "psdCache",
        "Stored loaded PSD cache",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.echoStep("STEP:psdCache:stored"),
      );
    } else {
      await this.runPhotopeaStep(
        "psdCache",
        "Reusing loaded PSD",
        ACTION_TIMEOUT_SCRIPT_MS,
        () => this.echoStep("STEP:psdCache:reuse"),
      );
    }
    console.log(`[Photopea] PSD document size: ${docWidth}x${docHeight}`);

    const placedDesign = await this.runPhotopeaStep(
      "browserTransform",
      "Applying placement controls in browser canvas",
      ACTION_TIMEOUT_FILE_MS,
      async () => {
        const result = await createBrowserPlacedDesignFile(
          design,
          normalizedSettings,
          docWidth,
          docHeight,
          designWidth,
          designHeight,
        );
        const d = result.details;
        console.log("[OpenMockup] browser placement details:", d);
        await this.echoStep(
          `STEP:browserTransform:area:${d.areaX.toFixed(1)},${d.areaY.toFixed(1)},${d.areaW.toFixed(1)},${d.areaH.toFixed(1)}`,
        );
        await this.echoStep(
          `STEP:browserTransform:target:${d.targetX.toFixed(1)},${d.targetY.toFixed(1)},${d.targetW.toFixed(1)},${d.targetH.toFixed(1)}`,
        );
        await this.echoStep(
          `STEP:browserTransform:final:${d.finalX.toFixed(1)},${d.finalY.toFixed(1)},${d.scaledW.toFixed(1)},${d.scaledH.toFixed(1)}:rotation=${d.rotation}:opacity=${d.opacity}:fit=${d.fitMode}:anchor=${d.anchor}`,
        );
        await this.echoStep("STEP:browserTransform:done");
        return result.file;
      },
    );

    const designUrl = await this.runPhotopeaStep(
      "uploadDesign",
      `Preparing transformed design URL: ${placedDesign.name}`,
      ACTION_TIMEOUT_FILE_MS,
      () => uploadDesignFile(placedDesign),
    );

    await this.runPhotopeaStep(
      "verifyDesignUrl",
      "Verifying public transformed design URL",
      ACTION_TIMEOUT_FILE_MS,
      () => verifyDesignUrlForPhotopea(designUrl),
    );

    // Step 3: Combined atomic operation — switch to PSD, cleanup previous design, select Smart Object.
    // All in one script to avoid Photopea losing DOM references across script boundaries.
    await this.runPhotopeaStep(
      "previewCleanupAndSelect",
      `Switching to PSD, cleaning up, selecting smart object: ${normalizedSettings.smartObjectName}`,
      ACTION_TIMEOUT_SCRIPT_MS * 3,
      () => this.runScript(buildPreviewCleanupAndSelectScript("OPENMOCKUP_PSD", normalizedSettings.smartObjectName), "STEP:smartobject:selectDone"),
    );

    // Step 5a: Trigger app.open() in Photopea (no polling inside the script).
    await this.runPhotopeaStep(
      "openAsSmartInPsd",
      "Opening design as smart object in PSD",
      ACTION_TIMEOUT_SCRIPT_MS,
      () => this.runScript(buildOpenAsSmartInPsdScript(designUrl, normalizedSettings.smartObjectName), "STEP:openAsSmartInPsd:openCalled"),
    );

    // Stable V5 fallback: do not inspect Photopea layers after app.open().
    // Several Photopea DOM calls (doc.activeLayer / doc.layers) can crash on this PSD with internal BX errors.
    // We simply wait for the async import to settle, then export the active PSD.
    await this.runPhotopeaStep(
      "openAsSmartInPsdSettle",
      "Waiting for Photopea to finish placing the design",
      ACTION_TIMEOUT_SCRIPT_MS,
      async () => {
        await this.delay(2500);
        return this.echoStep("STEP:openAsSmartInPsd:settleWait:done");
      },
    );

    await this.runPhotopeaStep(
      "transformPlaced",
      "Placement controls applied in browser before Photopea import",
      ACTION_TIMEOUT_SCRIPT_MS,
      () => this.echoStep("STEP:transformPlaced:appliedInBrowserCanvasV6"),
    );

    await this.runPhotopeaStep(
      "stabilize",
      "Stabilizing before export",
      ACTION_TIMEOUT_SCRIPT_MS,
      () => this.runScript(stabilizeAfterSaveScript, "STEP:stabilize:done"),
    );

    // Step 8: Export PNG (waits for ArrayBuffer + trailing "done")
    const buffer = await this.runPhotopeaStep(
      "exportPng",
      "Exporting PNG",
      ACTION_TIMEOUT_SCRIPT_MS,
      () => this.exportPng(),
    );

    console.log("[OpenMockup] render finished, loadedPsdKey:", this.loadedPsdKey);
    return new Blob([buffer], { type: "image/png" });
  }

  private openFile(file: File): Promise<string> {
    return this.postBinary(file, false, ACTION_TIMEOUT_FILE_MS) as Promise<string>;
  }

  private runScript(script: string, expectedMarker?: string): Promise<string> {
    return this.postString(script, false, ACTION_TIMEOUT_SCRIPT_MS, expectedMarker) as Promise<string>;
  }

  private echoStep(marker: string): Promise<string> {
    return this.runScript(`app.echoToOE(${JSON.stringify(marker)});\n"done";`, marker);
  }

  private closeAllDocuments(): Promise<string> {
    return this.runScript(closeAllDocumentsScript, "STEP:close-all:done");
  }

  // exportPng wartet explizit auf ArrayBuffer — "done" allein ist kein Bild
  private exportPng(): Promise<ArrayBuffer> {
    return this.postString(exportPngScript, true, ACTION_TIMEOUT_SCRIPT_MS, "STEP:export:done") as Promise<ArrayBuffer>;
  }

  private postString(
    script: string,
    binaryExpected: boolean,
    timeoutMs = ACTION_TIMEOUT_SCRIPT_MS,
    expectedMarker?: string,
  ): Promise<ArrayBuffer | string> {
    return this.enqueue(binaryExpected, timeoutMs, expectedMarker, () => {
      console.log(`[Photopea] send script (${script.length} chars)`);
      this.iframe.contentWindow?.postMessage(script, "*");
    });
  }

  private async postBinary(file: File, binaryExpected: boolean, timeoutMs = ACTION_TIMEOUT_FILE_MS): Promise<ArrayBuffer | string> {
    const buffer = await file.arrayBuffer();
    return this.enqueue(binaryExpected, timeoutMs, undefined, () => {
      console.log(`[Photopea] send file ${file.name} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
      this.iframe.contentWindow?.postMessage(buffer, "*", [buffer]);
    });
  }

  private enqueue(
    binaryExpected: boolean,
    timeoutMs: number,
    expectedMarker: string | undefined,
    send: () => void,
  ): Promise<ArrayBuffer | string> {
    if (this.fatalError) {
      return Promise.reject(this.fatalError);
    }

    if (this.pending) {
      return Promise.reject(new Error("Photopea is still busy with the previous step."));
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.failPending(new Error(`Photopea took too long to finish this action (timeout: ${formatSeconds(timeoutMs)}s).`));
      }, timeoutMs);

      this.pending = { resolve, reject, binaryExpected, timer, expectedMarker, expectedMarkerSeen: !expectedMarker, stepMessages: [] };
      send();
    });
  }

  // ------------------------------------------------------------------
  // Message-Handler — strikte Synchronisierung
  // ------------------------------------------------------------------
  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe.contentWindow) return;

    const data = event.data;

    // 1. Diagnose-Marker vom Script (echoToOE) — nur loggen, nie resolve/reject
    if (typeof data === "string" && data.startsWith("STEP:")) {
      console.log(`[Photopea] echo  ${data}`);
      this.pending?.stepMessages.push(data);
      if (this.pending?.expectedMarker && data.startsWith(this.pending.expectedMarker)) {
        this.pending.expectedMarkerSeen = true;
      }
      this.stepCallback({ step: "photopea", label: `Script: ${data.substring(5)}` });
      return;
    }

    // 2. ERROR vom Script (case-insensitive) — immer reject
    if (typeof data === "string" && data.startsWith("ERROR:")) {
      console.warn(`[Photopea] recv  ${data}`);
      const error = new Error(data);
      this.fatalError = error;
      this.rejectPending(error);
      return;
    }

    // 3. ArrayBuffer — PNG-Exportdaten von saveToOE()
    if (data instanceof ArrayBuffer) {
      console.log(`[Photopea] recv  ArrayBuffer (${(data.byteLength / 1024).toFixed(1)} KB)`);
      if (this.pending && this.pending.binaryExpected) {
        // Zwischenspeichern — wir warten noch auf das nachfolgende "done"
        this.pending.exportBuffer = data;
        console.log(`[Photopea] exportBuffer cached, waiting for "done"`);
      }
      return;
    }

    // 4. "done" — Photopea hat ein Skript abgeschlossen
    if (data === "done") {
      console.log(`[Photopea] recv  done`);

      // Initiales "done" ohne pending = Photopea ist ready
      if (!this.pending) {
        this.markReady();
        return;
      }

      // binaryExpected=true und wir haben den exportBuffer zwischengespeichert
      if (this.pending.binaryExpected && this.pending.exportBuffer) {
        if (!this.pending.expectedMarkerSeen) {
          this.failPending(new Error(`Photopea step failed: ${describeExpectedMarker(this.pending.expectedMarker)} did not finish`));
          return;
        }
        const buffer = this.pending.exportBuffer;
        console.log(`[Photopea] export complete (buffer + done)`);
        this.lastStepMessages = this.pending.stepMessages;
        this.pending.resolve(buffer);
        this.clearPending();
        return;
      }

      // binaryExpected=true OHNE exportBuffer → darf NICHT resolve auslösen
      if (this.pending.binaryExpected) {
        console.warn(`[Photopea] "done" received but no ArrayBuffer cached — ignoring`);
        return;
      }

      // Normaler String-"done" (binaryExpected=false)
      if (!this.pending.expectedMarkerSeen) {
        this.failPending(new Error(`Photopea step failed: ${describeExpectedMarker(this.pending.expectedMarker)} did not finish`));
        return;
      }
      this.resolvePending("done", false);
      return;
    }

    // 5. Unerwartete Strings — nur loggen, nicht resolve
    if (typeof data === "string") {
      console.log(`[Photopea] recv  string (${data.length} chars): ${data.substring(0, 120)}`);
      return;
    }

    console.log(`[Photopea] recv  unknown type: ${typeof data}`);
  };

  private markReady(): void {
    if (this.isReady) return;
    this.isReady = true;
    console.log("[Photopea] ready");
    this.readyResolver();
  }

  private resolvePending(value: ArrayBuffer | string, _isBinary: boolean): void {
    if (!this.pending) return;
    this.lastStepMessages = this.pending.stepMessages;
    this.pending.resolve(value);
    this.clearPending();
  }

  private rejectPending(reason: unknown): void {
    if (!this.pending) return;
    this.lastStepMessages = this.pending.stepMessages;
    this.pending.reject(reason);
    this.clearPending();
  }

  private failPending(error: Error): void {
    this.fatalError = error;
    this.rejectPending(error);
  }

  private clearPending(): void {
    if (!this.pending) return;
    window.clearTimeout(this.pending.timer);
    this.pending = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
