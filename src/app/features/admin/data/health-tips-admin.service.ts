import { inject, Service } from '@angular/core';
import type { HealthTip } from '../../../core/models/entities';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { likePattern, unwrap } from '../../../core/supabase/unwrap';

export interface HealthTipInput {
  text_ar: string;
  text_en: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface HealthTipQuery {
  term?: string;
  status?: 'active' | 'inactive' | 'all';
}

/** Admin management of the home page "tip of the day" entries. RLS limits writes to admins. */
@Service()
export class HealthTipsAdminService {
  private readonly supabase = inject(SupabaseService).client;

  async list(query: HealthTipQuery = {}): Promise<HealthTip[]> {
    let request = this.supabase.from('health_tips').select('*');

    const status = query.status ?? 'all';
    if (status !== 'all') request = request.eq('is_active', status === 'active');
    const term = query.term?.trim();
    if (term) {
      const pattern = '"' + likePattern(term).replace(/"/g, '') + '"';
      request = request.or('text_ar.ilike.' + pattern + ',text_en.ilike.' + pattern);
    }

    const result = await request.order('sort_order').order('created_at').limit(500);
    return unwrap<HealthTip[]>(result) ?? [];
  }

  async save(input: HealthTipInput, id?: string): Promise<void> {
    const request = id
      ? this.supabase.from('health_tips').update(input).eq('id', id)
      : this.supabase.from('health_tips').insert(input);
    unwrap(await request);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    unwrap(await this.supabase.from('health_tips').update({ is_active: isActive }).eq('id', id));
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.supabase.from('health_tips').delete().eq('id', id));
  }
}
