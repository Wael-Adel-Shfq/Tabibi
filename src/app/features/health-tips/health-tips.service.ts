import { inject, Service } from '@angular/core';
import type { HealthTip } from '../../core/models/entities';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { unwrap } from '../../core/supabase/unwrap';

const DAY_MS = 86_400_000;

/** Reads the active "tip of the day" entries for the home page. */
@Service()
export class HealthTipsService {
  private readonly supabase = inject(SupabaseService).client;

  /**
   * Today's tip: the active tips in their admin-set order, one per day,
   * starting again from the first after the last. Null when there are none.
   */
  async today(now = Date.now()): Promise<HealthTip | null> {
    const result = await this.supabase
      .from('health_tips')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at');
    return pickForDay(unwrap<HealthTip[]>(result) ?? [], now);
  }
}

/** The tip for the day containing `now`; the same for every visitor that day. */
export function pickForDay<T>(tips: readonly T[], now: number): T | null {
  if (tips.length === 0) return null;
  return tips[Math.floor(now / DAY_MS) % tips.length];
}
