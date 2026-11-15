import { inject, Service } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { IMAGE_TYPES, resizeToWebp } from '../../shared/utils/image';

/** Public buckets that hold images. Writes are admin-only (storage policies). */
export type ImageBucket = 'ad-images' | 'listing-images';

/** Size rules per bucket; `maxBytes` matches the bucket's hard limit. */
export const IMAGE_RULES: Readonly<Record<ImageBucket, { maxWidth: number; maxBytes: number }>> = {
  'ad-images': { maxWidth: 1200, maxBytes: 2 * 1024 * 1024 },
  'listing-images': { maxWidth: 800, maxBytes: 1024 * 1024 },
};

/** What a form should do with a record's image when it is saved. */
export type ImageChange =
  | { action: 'keep' }
  | { action: 'replace'; file: File }
  | { action: 'remove' };

/** Thrown when a picked file is not an acceptable image. */
export class ImageRejectedError extends Error {
  constructor(readonly reason: 'type' | 'size') {
    super('image_rejected_' + reason);
  }
}

/**
 * Uploads, serves and removes images. Every upload is resized in the browser
 * and re-encoded as WebP under a random name, so images stay small and are
 * never overwritten in place.
 */
@Service()
export class ImageStorageService {
  private readonly supabase = inject(SupabaseService).client;

  publicUrl(bucket: ImageBucket, path: string): string {
    return this.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Validates, resizes and uploads a file; returns its storage path. */
  async upload(bucket: ImageBucket, file: File): Promise<string> {
    if (!IMAGE_TYPES.includes(file.type)) throw new ImageRejectedError('type');
    const rules = IMAGE_RULES[bucket];
    const blob = await resizeToWebp(file, rules.maxWidth);
    if (blob.size > rules.maxBytes) throw new ImageRejectedError('size');

    const path = crypto.randomUUID() + '.webp';
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return path;
  }

  /**
   * Applies an image change around a record save: uploads a new image first,
   * saves the record with the resulting path, then removes the image it
   * replaced. If the save fails, the new upload is removed again.
   */
  async saveWithImage(
    bucket: ImageBucket,
    change: ImageChange,
    previousPath: string | null,
    save: (imagePath: string | null) => Promise<void>,
  ): Promise<void> {
    const uploaded = change.action === 'replace' ? await this.upload(bucket, change.file) : null;
    const nextPath = change.action === 'keep' ? previousPath : uploaded;
    try {
      await save(nextPath);
    } catch (error) {
      await this.remove(bucket, uploaded);
      throw error;
    }
    if (previousPath && previousPath !== nextPath) await this.remove(bucket, previousPath);
  }

  /** Best-effort removal of an image nothing references any more. */
  async remove(bucket: ImageBucket, path: string | null | undefined): Promise<void> {
    if (!path) return;
    await this.supabase.storage.from(bucket).remove([path]);
  }
}
