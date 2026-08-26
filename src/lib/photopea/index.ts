import type { MockupSettings } from "../../types";
import { PhotopeaClient as BasePhotopeaClient, type StepCallback } from "./PhotopeaClient";
import {
  PHOTOPEA_READY_TIMEOUT_MS,
  createPhotopeaReadyTimeoutError,
  withTimeout,
} from "./readyTimeout";

const DESTROYED_ERROR_MESSAGE = "Photopea connection was closed.";
const OLD_PUBLIC_URL_GUIDANCE =
  "Photopea needs a public HTTPS design URL for the design asset. Run `npm run dev:public` " +
  "and open the shown trycloudflare.com URL, or set OPENMOCKUP_PUBLIC_BASE_URL to your public HTTPS tunnel URL.";
const PUBLIC_URL_GUIDANCE =
  "Photopea needs a public HTTPS design URL for the design asset. Run `npm run dev:public` and keep using the local " +
  "OpenMockup tab it opens; the trycloudflare.com URL is used only as Photopea's public asset base. " +
  "Or set OPENMOCKUP_PUBLIC_BASE_URL to your public HTTPS tunnel URL.";

export class PhotopeaClient extends BasePhotopeaClient {
  private destroyedError: Error | null = null;
  private destroyedPromise: Promise<void>;
  private resolveDestroyed!: () => void;

  constructor(iframe: HTMLIFrameElement, onStep?: StepCallback) {
    super(iframe, onStep);
    this.destroyedPromise = new Promise((resolve) => {
      this.resolveDestroyed = resolve;
    });
  }

  override async waitUntilReady(): Promise<void> {
    if (this.destroyedError) throw this.destroyedError;

    const state = await withTimeout(
      Promise.race([
        super.waitUntilReady().then(() => "ready" as const),
        this.destroyedPromise.then(() => "destroyed" as const),
      ]),
      PHOTOPEA_READY_TIMEOUT_MS,
      () => createPhotopeaReadyTimeoutError(PHOTOPEA_READY_TIMEOUT_MS),
    );

    if (state === "destroyed") {
      throw this.destroyedError ?? new Error(DESTROYED_ERROR_MESSAGE);
    }
  }

  override async renderMockup(
    psd: File,
    design: File,
    settings: MockupSettings,
    designWidth?: number,
    designHeight?: number,
  ): Promise<Blob> {
    try {
      return await super.renderMockup(psd, design, settings, designWidth, designHeight);
    } catch (error) {
      if (error instanceof Error && error.message === OLD_PUBLIC_URL_GUIDANCE) {
        error.message = PUBLIC_URL_GUIDANCE;
      }
      throw error;
    }
  }

  override destroy(): void {
    if (!this.destroyedError) {
      this.destroyedError = new Error(DESTROYED_ERROR_MESSAGE);
      this.resolveDestroyed();
    }
    super.destroy();
  }
}

export { PHOTOPEA_READY_TIMEOUT_MS, createPhotopeaReadyTimeoutError, withTimeout } from "./readyTimeout";
