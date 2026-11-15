import { inject, Service } from '@angular/core';
import type { DashboardStats } from '../../../core/models/entities';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { unwrap } from '../../../core/supabase/unwrap';

@Service()
export class DashboardService {
  private readonly supabase = inject(SupabaseService).client;

  async stats(): Promise<DashboardStats> {
    return unwrap<DashboardStats>(await this.supabase.rpc('admin_dashboard_stats'));
  }
}
