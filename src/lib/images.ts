const imageCache = new WeakMap<File, Promise<HTMLImageElement>>();

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const cached = imageCache.get(file);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      imageCache.delete(file);
      reject(new Error(`Could not load image ${file.name}`));
    };
    image.src = url;
  });

  imageCache.set(file, promise);
  return promise;
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const image = await loadImageFromFile(file);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}
