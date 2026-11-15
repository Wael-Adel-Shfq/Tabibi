import { inject, Service } from '@angular/core';
import { AdPlacement, Advertisement, Page, PAGE_SIZE } from '../../core/models/entities';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { likePattern, unwrap, unwrapPage } from '../../core/supabase/unwrap';
import { ImageStorageService } from '../../core/storage/image-storage.service';

const BUCKET = 'ad-images' as const;
const AD_SELECT = '*, location_chain';

export interface AdInput {
  title: string;
  advertiser_name: string;
  image_path: string;
  /** Optional targeting: any level of the location tree, or null for everywhere. */
  location_id: string | null;
  address: string | null;
  map_url: string | null;
  phone: string | null;
  placement: AdPlacement;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  popup_delay_seconds: number;
  popup_duration_seconds: number | null;
  popup_repeat_hours: number;
}

export interface AdQuery {
  term?: string;
  placement?: AdPlacement | '';
  page?: number;
}

@Service()
export class AdsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly images = inject(ImageStorageService);

  /**
   * Advertisements to show in one placement right now. The period filter is
   * repeated here (RLS already applies it to visitors) so a signed-in admin
   * browsing the public pages sees exactly what visitors see.
   *
   * With a chosen location chain, only ads targeted at no location or at one
   * of the chosen places (or their ancestors) are shown.
   */
  async listForPlacement(placement: AdPlacement, locationPath: readonly string[] = []): Promise<Advertisement[]> {
    const now = '"' + new Date().toISOString() + '"';
    let request = this.supabase
      .from('advertisements')
      .select('*')
      .eq('placement', placement)
      .eq('is_active', true)
      .or('starts_at.is.null,starts_at.lte.' + now)
      .or('ends_at.is.null,ends_at.gt.' + now);
    if (locationPath.length > 0) {
      request = request.or('location_id.is.null,location_id.in.(' + locationPath.join(',') + ')');
    }
    return unwrap<Advertisement[]>(await request.order('display_order').order('created_at')) ?? [];
  }

  imageUrl(path: string): string {
    return this.images.publicUrl(BUCKET, path);
  }

  // --- Admin operations ---

  async list(query: AdQuery = {}): Promise<Page<Advertisement>> {
    const from = (query.page ?? 0) * PAGE_SIZE;
    let request = this.supabase.from('advertisements').select(AD_SELECT, { count: 'exact' });
    if (query.placement) request = request.eq('placement', query.placement);
    const term = query.term?.trim();
    if (term) {
      const pattern = '"' + likePattern(term).replace(/"/g, '') + '"';
      request = request.or('title.ilike.' + pattern + ',advertiser_name.ilike.' + pattern);
    }
    const result = await request
      .order('placement')
      .order('display_order')
      .range(from, from + PAGE_SIZE - 1);
    return unwrapPage<Advertisement>(result);
  }

  async save(input: AdInput, id?: string): Promise<void> {
    const request = id
      ? this.supabase.from('advertisements').update(input).eq('id', id)
      : this.supabase.from('advertisements').insert(input);
    unwrap(await request);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('advertisements').update({ is_active: isActive }).eq('id', id));
  }

  /** Deletes the advertisement and then its image, which nothing references any more. */
  async remove(ad: Advertisement): Promise<void> {
    unwrap(await this.supabase.from('advertisements').delete().eq('id', ad.id));
    await this.removeImage(ad.image_path);
  }

  /** Resizes and uploads an advertisement image; returns its storage path. */
  uploadImage(file: File): Promise<string> {
    return this.images.upload(BUCKET, file);
  }

  /** Best-effort removal of an image that is no longer referenced. */
  removeImage(path: string | null | undefined): Promise<void> {
    return this.images.remove(BUCKET, path);
  }
}
