export function preloadImage(src: string, srcSet?: string, sizes?: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve();
      return;
    }

    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;

    if (sizes) img.sizes = sizes;
    if (srcSet) img.srcset = srcSet;
    img.src = src;

    if (img.complete) done();
  });
}
