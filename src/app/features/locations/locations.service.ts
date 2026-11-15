import { inject, Service, signal } from '@angular/core';
import type { Location, Specialty } from '../../core/models/entities';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { unwrap } from '../../core/supabase/unwrap';

const ROOT = 'root';

/**
 * Read-only reference data for pickers and filters: the active location tree
 * (loaded one level at a time) and the active specialties. Results are cached
 * for the session; `refresh()` drops the cache after an admin edit.
 */
@Service()
export class LocationsService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly specialtyState = signal<Specialty[]>([]);
  private readonly childCache = new Map<string, Promise<Location[]>>();
  private loading: Promise<void> | null = null;

  readonly specialties = this.specialtyState.asReadonly();

  /** Loads the specialties once; safe to call from every page. */
  load(): Promise<void> {
    this.loading ??= this.fetchSpecialties().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  /** Active children of a location; `null` gives the governorates. */
  children(parentId: string | null): Promise<Location[]> {
    const key = parentId ?? ROOT;
    let pending = this.childCache.get(key);
    if (!pending) {
      pending = this.fetchChildren(parentId).catch((error: unknown) => {
        this.childCache.delete(key);
        throw error;
      });
      this.childCache.set(key, pending);
    }
    return pending;
  }

  refresh(): Promise<void> {
    this.childCache.clear();
    this.loading = null;
    return this.load();
  }

  private async fetchSpecialties(): Promise<void> {
    const result = await this.supabase
      .from('specialties')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('name_ar');
    this.specialtyState.set(unwrap<Specialty[]>(result) ?? []);
  }

  private async fetchChildren(parentId: string | null): Promise<Location[]> {
    let request = this.supabase.from('locations').select('*').eq('is_active', true);
    request = parentId ? request.eq('parent_id', parentId) : request.is('parent_id', null);
    const result = await request.order('sort_order').order('name_ar');
    return unwrap<Location[]>(result) ?? [];
  }
}
