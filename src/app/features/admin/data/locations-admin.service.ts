import { inject, Service } from '@angular/core';
import { CHILD_KINDS, Location, LocationKind } from '../../../core/models/entities';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { likePattern, unwrap } from '../../../core/supabase/unwrap';

export interface LocationInput {
  parent_id: string | null;
  kind: LocationKind;
  name_ar: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface LocationQuery {
  term?: string;
  status?: 'active' | 'inactive' | 'all';
}

/** Kinds that may contain a location of the given kind. */
export function parentKindsOf(kind: LocationKind): LocationKind[] {
  return (Object.keys(CHILD_KINDS) as (LocationKind | 'root')[]).filter(
    (parent): parent is LocationKind => parent !== 'root' && CHILD_KINDS[parent].includes(kind),
  );
}

/** Admin management of the location tree. RLS lets admins see inactive rows too. */
@Service()
export class LocationsAdminService {
  private readonly supabase = inject(SupabaseService).client;

  /** Children of one location (`null` = governorates), including inactive ones. */
  async children(parentId: string | null, query: LocationQuery = {}): Promise<Location[]> {
    let request = this.supabase.from('locations').select('*');
    request = parentId ? request.eq('parent_id', parentId) : request.is('parent_id', null);

    const status = query.status ?? 'all';
    if (status !== 'all') request = request.eq('is_active', status === 'active');
    const term = query.term?.trim();
    if (term) {
      const pattern = '"' + likePattern(term).replace(/"/g, '') + '"';
      request = request.or('name_ar.ilike.' + pattern + ',name_en.ilike.' + pattern);
    }

    const result = await request.order('sort_order').order('name_ar').limit(1000);
    return unwrap<Location[]>(result) ?? [];
  }

  /** The location and its ancestors, from the governorate down. */
  async chain(id: string): Promise<Location[]> {
    const own = unwrap<Location | null>(
      await this.supabase.from('locations').select('*').eq('id', id).maybeSingle(),
    );
    if (!own) return [];
    const rows = unwrap<Location[]>(await this.supabase.from('locations').select('*').in('id', own.path)) ?? [];
    return own.path.map((step) => rows.find((row) => row.id === step)).filter((row) => row !== undefined);
  }

  /**
   * Places a location could move to: same governorate, a kind that may
   * contain it, and not the location itself or one of its descendants.
   */
  async possibleParents(location: Location): Promise<Location[]> {
    const kinds = parentKindsOf(location.kind);
    if (kinds.length === 0) return [];
    const result = await this.supabase
      .from('locations')
      .select('*')
      .contains('path', [location.path[0]])
      .in('kind', kinds)
      .not('path', 'cs', '{' + location.id + '}')
      .order('kind')
      .order('name_ar')
      .limit(1000);
    return unwrap<Location[]>(result) ?? [];
  }

  async save(input: LocationInput, id?: string): Promise<void> {
    const request = id
      ? this.supabase.from('locations').update(input).eq('id', id)
      : this.supabase.from('locations').insert(input);
    unwrap(await request);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('locations').update({ is_active: isActive }).eq('id', id));
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.supabase.from('locations').delete().eq('id', id));
  }
}
