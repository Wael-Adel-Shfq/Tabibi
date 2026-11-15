export const AD_IMAGE_MAX_WIDTH = 1200;
export const AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const AD_IMAGE_TYPES: readonly string[] = ['image/webp', 'image/jpeg', 'image/png'];

/**
 * Downscales an image to at most `maxWidth` pixels wide and re-encodes it as
 * WebP, so uploads stay small and consistent whatever the admin picked.
 */
export async function resizeToWebp(file: File, maxWidth = AD_IMAGE_MAX_WIDTH): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
        'image/webp',
        0.82,
      );
    });
  } finally {
    bitmap.close();
  }
}
