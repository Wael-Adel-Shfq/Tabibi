import { inject, Service } from '@angular/core';
import { Facility, FacilityType, Page, PAGE_SIZE } from '../../core/models/entities';
import { ImageChange, ImageStorageService } from '../../core/storage/image-storage.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { likePattern, unwrap, unwrapPage } from '../../core/supabase/unwrap';
import { normalizeArabic } from '../../shared/utils/arabic';

const FACILITY_SELECT = '*, location_chain';

export interface FacilityQuery {
  type?: FacilityType | '';
  term?: string;
  /** Any level of the location tree; matches everything underneath it. */
  locationId?: string;
  /** Admin only: 'all' includes inactive facilities. */
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  pageSize?: number;
}

export interface FacilityInput {
  name: string;
  type: FacilityType;
  location_id: string;
  address: string;
  phone: string | null;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

const IMAGES = 'listing-images' as const;

@Service()
export class FacilitiesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly images = inject(ImageStorageService);

  /** Public URL of a record's image, or null when it has none. */
  imageUrl(path: string | null | undefined): string | null {
    return path ? this.images.publicUrl(IMAGES, path) : null;
  }

  async search(query: FacilityQuery = {}): Promise<Page<Facility>> {
    const pageSize = query.pageSize ?? PAGE_SIZE;
    const from = (query.page ?? 0) * pageSize;

    let request = this.supabase.from('facilities').select(FACILITY_SELECT, { count: 'exact' });

    const status = query.status ?? 'active';
    if (status !== 'all') request = request.eq('is_active', status === 'active');

    if (query.type) request = request.eq('type', query.type);
    const term = normalizeArabic(query.term);
    if (term) request = request.ilike('search_text', likePattern(term));
    if (query.locationId) request = request.contains('location_path', [query.locationId]);

    const result = await request.order('name').order('id').range(from, from + pageSize - 1);
    return unwrapPage<Facility>(result);
  }

  // --- Admin operations (allowed by RLS for administrators only) ---

  /** Saves the record and applies the image change (upload, replace or remove). */
  async save(input: FacilityInput, image: ImageChange, existing?: Facility): Promise<void> {
    await this.images.saveWithImage(IMAGES, image, existing?.image_path ?? null, async (image_path) => {
      const values = { ...input, image_path };
      const request = existing
        ? this.supabase.from('facilities').update(values).eq('id', existing.id)
        : this.supabase.from('facilities').insert(values);
      unwrap(await request);
    });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('facilities').update({ is_active: isActive }).eq('id', id));
  }

  /** Deletes the record, then its image, which nothing references any more. */
  async remove(record: Facility): Promise<void> {
    unwrap(await this.supabase.from('facilities').delete().eq('id', record.id));
    await this.images.remove(IMAGES, record.image_path);
  }
}
