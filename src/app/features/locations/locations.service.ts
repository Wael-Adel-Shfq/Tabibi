import { inject, Service, signal } from '@angular/core';
import type { Area, Governorate, Specialty } from '../../core/models/entities';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { unwrap } from '../../core/supabase/unwrap';

/**
 * Read-only reference data for the public app and for form dropdowns:
 * active governorates, their areas and specialties. Results are cached for
 * the session; `refresh()` drops the cache after an admin edits a lookup.
 */
@Service()
export class LocationsService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly governorateState = signal<Governorate[]>([]);
  private readonly specialtyState = signal<Specialty[]>([]);
  private readonly areaCache = new Map<string, Promise<Area[]>>();
  private loading: Promise<void> | null = null;

  readonly governorates = this.governorateState.asReadonly();
  readonly specialties = this.specialtyState.asReadonly();

  /** Loads governorates and specialties once; safe to call from every page. */
  load(): Promise<void> {
    this.loading ??= this.fetch().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  /** Active areas of one governorate, ordered for display. */
  areasOf(governorateId: string): Promise<Area[]> {
    if (!governorateId) return Promise.resolve([]);
    let pending = this.areaCache.get(governorateId);
    if (!pending) {
      pending = this.fetchAreas(governorateId).catch((error: unknown) => {
        this.areaCache.delete(governorateId);
        throw error;
      });
      this.areaCache.set(governorateId, pending);
    }
    return pending;
  }

  refresh(): Promise<void> {
    this.areaCache.clear();
    this.loading = null;
    return this.load();
  }

  private async fetch(): Promise<void> {
    const [governorates, specialties] = await Promise.all([
      this.supabase
        .from('governorates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name_ar'),
      this.supabase
        .from('specialties')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name_ar'),
    ]);
    this.governorateState.set(unwrap<Governorate[]>(governorates) ?? []);
    this.specialtyState.set(unwrap<Specialty[]>(specialties) ?? []);
  }

  private async fetchAreas(governorateId: string): Promise<Area[]> {
    const result = await this.supabase
      .from('areas')
      .select('*')
      .eq('governorate_id', governorateId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name_ar');
    return unwrap<Area[]>(result) ?? [];
  }
}
