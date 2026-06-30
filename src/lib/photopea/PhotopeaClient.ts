import { buildReplaceSmartObjectScript, closeAllDocumentsScript, exportPngScript } from "./scripts";
import type { MockupSettings } from "../../types";

const PHOTOPEA_URL = "https://www.photopea.com#";
const IFRAME_READY_GRACE_MS = 8000;
const ACTION_TIMEOUT_MS = 120000;

type PendingAction = {
  resolve: (value: ArrayBuffer | string) => void;
  reject: (reason?: unknown) => void;
  binaryExpected: boolean;
  timer: number;
};

export class PhotopeaClient {
  private iframe: HTMLIFrameElement;
  private pending: PendingAction | null = null;
  private readyPromise: Promise<void>;
  private readyResolver!: () => void;
  private readyTimer: number | undefined;
  private isReady = false;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolver = resolve;
    });
    window.addEventListener("message", this.handleMessage);
    this.iframe.addEventListener("load", this.handleIframeLoad);
    this.iframe.src = PHOTOPEA_URL;
  }

  destroy(): void {
    window.removeEventListener("message", this.handleMessage);
    this.iframe.removeEventListener("load", this.handleIframeLoad);
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    this.rejectPending(new Error("Photopea connection was closed."));
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  async renderMockup(psd: File, design: File, settings: MockupSettings): Promise<Blob> {
    await this.waitUntilReady();
    await this.closeAllDocuments();
    await this.openFile(psd);
    await this.openFile(design);
    await this.runScript(buildReplaceSmartObjectScript(settings));
    const buffer = await this.exportPng();
    return new Blob([buffer], { type: "image/png" });
  }

  private openFile(file: File): Promise<string> {
    return this.postBinary(file, false) as Promise<string>;
  }

  private runScript(script: string): Promise<string> {
    return this.postString(script, false) as Promise<string>;
  }

  private closeAllDocuments(): Promise<string> {
    return this.runScript(closeAllDocumentsScript);
  }

  private exportPng(): Promise<ArrayBuffer> {
    return this.postString(exportPngScript, true) as Promise<ArrayBuffer>;
  }

  private postString(script: string, binaryExpected: boolean): Promise<ArrayBuffer | string> {
    return this.enqueue(binaryExpected, () => {
      this.iframe.contentWindow?.postMessage(script, "*");
    });
  }

  private async postBinary(file: File, binaryExpected: boolean): Promise<ArrayBuffer | string> {
    const buffer = await file.arrayBuffer();
    return this.enqueue(binaryExpected, () => {
      this.iframe.contentWindow?.postMessage(buffer, "*", [buffer]);
    });
  }

  private enqueue(binaryExpected: boolean, send: () => void): Promise<ArrayBuffer | string> {
    if (this.pending) {
      return Promise.reject(new Error("Photopea is still busy with the previous step."));
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.rejectPending(new Error("Photopea took too long to finish this action."));
      }, ACTION_TIMEOUT_MS);

      this.pending = { resolve, reject, binaryExpected, timer };
      send();
    });
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== this.iframe.contentWindow) return;

    if (event.data === "done") {
      this.markReady();
      this.resolvePending("done", false);
      return;
    }

    if (typeof event.data === "string" && event.data.startsWith("ERROR")) {
      this.rejectPending(new Error(event.data));
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      this.resolvePending(event.data, true);
    }
  };

  private handleIframeLoad = (): void => {
    if (this.isReady) return;
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    this.readyTimer = window.setTimeout(() => this.markReady(), IFRAME_READY_GRACE_MS);
  };

  private markReady(): void {
    if (this.isReady) return;
    this.isReady = true;
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    this.readyResolver();
  }

  private resolvePending(value: ArrayBuffer | string, isBinary: boolean): void {
    if (!this.pending) return;
    if (this.pending.binaryExpected !== isBinary) {
      if (isBinary) return;
      this.pending.resolve(value);
      this.clearPending();
      return;
    }

    this.pending.resolve(value);
    this.clearPending();
  }

  private rejectPending(reason: unknown): void {
    if (!this.pending) return;
    this.pending.reject(reason);
    this.clearPending();
  }

  private clearPending(): void {
    if (!this.pending) return;
    window.clearTimeout(this.pending.timer);
    this.pending = null;
  }
}
