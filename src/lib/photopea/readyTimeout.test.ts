import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./readyTimeout";

afterEach(() => {
  vi.useRealTimers();
});

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
