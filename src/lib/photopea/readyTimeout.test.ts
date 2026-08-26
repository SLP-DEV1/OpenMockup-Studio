import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotopeaClient } from "./index";
import { PHOTOPEA_READY_TIMEOUT_MS, withTimeout } from "./readyTimeout";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function createFakeWindow(): Window {
  return {
    localStorage: { getItem: () => null },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Window;
}

function createFakeIframe(): HTMLIFrameElement {
  return {
    src: "",
    contentWindow: {},
  } as unknown as HTMLIFrameElement;
}

describe("withTimeout", () => {
  it("keeps the fast path unchanged when the promise resolves", async () => {
    await expect(withTimeout(Promise.resolve("ready"), 1_000, () => new Error("timeout"))).resolves.toBe("ready");
  });

  it("rejects with the supplied error when the promise never settles", async () => {
    vi.useFakeTimers();

    const pending = withTimeout(
      new Promise<void>(() => undefined),
      50,
      () => new Error("Photopea did not finish loading"),
    );
    const assertion = expect(pending).rejects.toThrow("Photopea did not finish loading");

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});

describe("PhotopeaClient readiness", () => {
  it("times out when Photopea never reaches its initial ready state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", createFakeWindow());

    const client = new PhotopeaClient(createFakeIframe());
    const pending = client.waitUntilReady();
    const assertion = expect(pending).rejects.toThrow("Photopea did not finish loading within 90s");

    await vi.advanceTimersByTimeAsync(PHOTOPEA_READY_TIMEOUT_MS);
    await assertion;
    client.destroy();
  });

  it("unblocks readiness waiters when the client is destroyed", async () => {
    vi.stubGlobal("window", createFakeWindow());

    const client = new PhotopeaClient(createFakeIframe());
    const pending = client.waitUntilReady();
    const assertion = expect(pending).rejects.toThrow("Photopea connection was closed.");

    client.destroy();
    await assertion;
  });
});
