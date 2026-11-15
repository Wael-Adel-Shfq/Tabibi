import { inject, Service } from '@angular/core';
import type { Lookup } from '../../../core/models/entities';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { likePattern, unwrap } from '../../../core/supabase/unwrap';

/** Flat lookup tables managed from the admin. Locations have their own tree page. */
export type LookupTable = 'specialties';

export interface LookupInput {
  name_ar: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
}

export interface LookupQuery {
  term?: string;
  status?: 'active' | 'inactive' | 'all';
}

@Service()
export class LookupsAdminService {
  private readonly supabase = inject(SupabaseService).client;

  async list(table: LookupTable, query: LookupQuery = {}): Promise<Lookup[]> {
    let request = this.supabase.from(table).select('*');

    const status = query.status ?? 'all';
    if (status !== 'all') request = request.eq('is_active', status === 'active');
    const term = query.term?.trim();
    if (term) {
      const pattern = '"' + likePattern(term).replace(/"/g, '') + '"';
      request = request.or('name_ar.ilike.' + pattern + ',name_en.ilike.' + pattern);
    }

    const result = await request.order('sort_order').order('name_ar').limit(500);
    return unwrap<Lookup[]>(result) ?? [];
  }

  async save(table: LookupTable, input: LookupInput, id?: string): Promise<void> {
    const request = id
      ? this.supabase.from(table).update(input).eq('id', id)
      : this.supabase.from(table).insert(input);
    unwrap(await request);
  }

  async setActive(table: LookupTable, id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from(table).update({ is_active: isActive }).eq('id', id));
  }
}
