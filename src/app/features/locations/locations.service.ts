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

  private readonly versionState = signal(0);
  /** Increments whenever cached tree data is dropped; pickers reload when it changes. */
  readonly version = this.versionState.asReadonly();

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

  /**
   * Like `children`, but any region in the list is replaced by what is under
   * it. Visitors then pick Cairo and go straight to its districts and cities,
   * without the regions the admin uses to organise them.
   */
  async childrenSkippingRegions(parentId: string | null): Promise<Location[]> {
    const list = await this.children(parentId);
    if (!list.some((location) => location.kind === 'region')) return list;
    const groups = await Promise.all(
      list.map((location) =>
        location.kind === 'region' ? this.children(location.id) : Promise.resolve([location]),
      ),
    );
    // Sort orders are per region, so mixing them means nothing; go by name.
    return groups.flat().sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
  }

  refresh(): Promise<void> {
    this.childCache.clear();
    this.loading = null;
    this.versionState.update((v) => v + 1);
    return this.load();
  }

  /** Drops the cached children of one location, e.g. after an admin adds a place under it. */
  invalidate(parentId: string | null): void {
    this.childCache.delete(parentId ?? ROOT);
    this.versionState.update((v) => v + 1);
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
