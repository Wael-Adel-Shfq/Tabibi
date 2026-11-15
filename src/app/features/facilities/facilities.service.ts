import { inject, Service } from '@angular/core';
import { Facility, FacilityType, Page, PAGE_SIZE } from '../../core/models/entities';
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

@Service()
export class FacilitiesService {
  private readonly supabase = inject(SupabaseService).client;

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

  async save(input: FacilityInput, id?: string): Promise<void> {
    const request = id
      ? this.supabase.from('facilities').update(input).eq('id', id)
      : this.supabase.from('facilities').insert(input);
    unwrap(await request);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('facilities').update({ is_active: isActive }).eq('id', id));
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.supabase.from('facilities').delete().eq('id', id));
  }
}
