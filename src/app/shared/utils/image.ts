/** File types accepted for uploaded images (before conversion to WebP). */
export const IMAGE_TYPES: readonly string[] = ['image/webp', 'image/jpeg', 'image/png'];

/**
 * Downscales an image to at most `maxWidth` pixels wide and re-encodes it as
 * WebP. If the result is still large, the quality is lowered step by step so
 * typical phone photos fit the bucket limits.
 */
export async function resizeToWebp(file: File, maxWidth: number, targetBytes = 900 * 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let blob = await encode(canvas, 0.85);
    for (const quality of [0.75, 0.65, 0.55]) {
      if (blob.size <= targetBytes) break;
      blob = await encode(canvas, quality);
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))), 'image/webp', quality);
  });
}
