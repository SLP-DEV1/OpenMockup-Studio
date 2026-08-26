export const PHOTOPEA_READY_TIMEOUT_MS = 90_000;

export function createPhotopeaReadyTimeoutError(timeoutMs = PHOTOPEA_READY_TIMEOUT_MS): Error {
  return new Error(
    `Photopea did not finish loading within ${Math.round(timeoutMs / 1000)}s. ` +
      "Check your internet connection, browser privacy or ad-blocking settings, and whether photopea.com can load in an iframe. " +
      "Then reload OpenMockup Studio and try PSD mode again.",
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createError: () => Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(createError());
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}
