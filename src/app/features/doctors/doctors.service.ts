import { inject, Service } from '@angular/core';
import { Doctor, Page, PAGE_SIZE } from '../../core/models/entities';
import { ImageChange, ImageStorageService } from '../../core/storage/image-storage.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { likePattern, unwrap, unwrapPage } from '../../core/supabase/unwrap';
import { normalizeArabic } from '../../shared/utils/arabic';

const DOCTOR_SELECT = '*, specialty:specialties(id, name_ar, name_en), location_chain';

export interface DoctorQuery {
  term?: string;
  specialtyId?: string;
  /** Any level of the location tree; matches everything underneath it. */
  locationId?: string;
  /** Admin only: 'all' includes inactive doctors. Public callers leave it unset. */
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  pageSize?: number;
}

/** Values the admin form can write. */
export interface DoctorInput {
  full_name: string;
  specialty_id: string;
  clinic_phone: string | null;
  location_id: string;
  address: string;
  map_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

const IMAGES = 'listing-images' as const;

@Service()
export class DoctorsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly images = inject(ImageStorageService);

  /** Public URL of a record's image, or null when it has none. */
  imageUrl(path: string | null | undefined): string | null {
    return path ? this.images.publicUrl(IMAGES, path) : null;
  }

  /** Searches doctors by name or specialty, combined with location filters. */
  async search(query: DoctorQuery = {}): Promise<Page<Doctor>> {
    const pageSize = query.pageSize ?? PAGE_SIZE;
    const from = (query.page ?? 0) * pageSize;

    let request = this.supabase.from('doctors').select(DOCTOR_SELECT, { count: 'exact' });

    const status = query.status ?? 'active';
    if (status !== 'all') request = request.eq('is_active', status === 'active');

    const term = normalizeArabic(query.term);
    if (term) request = request.ilike('search_text', likePattern(term));
    if (query.specialtyId) request = request.eq('specialty_id', query.specialtyId);
    if (query.locationId) request = request.contains('location_path', [query.locationId]);

    const result = await request
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + pageSize - 1);
    return unwrapPage<Doctor>(result);
  }

  async recent(limit = 6): Promise<Doctor[]> {
    return (await this.search({ pageSize: limit })).items;
  }

  async getById(id: string): Promise<Doctor | null> {
    const result = await this.supabase
      .from('doctors')
      .select(DOCTOR_SELECT)
      .eq('id', id)
      .maybeSingle();
    return unwrap<Doctor | null>(result);
  }

  // --- Admin operations (allowed by RLS for administrators only) ---

  /** Saves the record and applies the image change (upload, replace or remove). */
  async save(input: DoctorInput, image: ImageChange, existing?: Doctor): Promise<void> {
    await this.images.saveWithImage(IMAGES, image, existing?.image_path ?? null, async (image_path) => {
      const values = { ...input, image_path };
      const request = existing
        ? this.supabase.from('doctors').update(values).eq('id', existing.id)
        : this.supabase.from('doctors').insert(values);
      unwrap(await request);
    });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('doctors').update({ is_active: isActive }).eq('id', id));
  }

  /** Deletes the record, then its image, which nothing references any more. */
  async remove(record: Doctor): Promise<void> {
    unwrap(await this.supabase.from('doctors').delete().eq('id', record.id));
    await this.images.remove(IMAGES, record.image_path);
  }
}
