import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { DashboardStats } from '../../../core/models/entities';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { DashboardService } from '../data/dashboard.service';

interface StatCard {
  label: string;
  value: number;
  link: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, TranslatePipe, LoadingState, ErrorState],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AdminDashboard {
  private readonly dashboard = inject(DashboardService);

  private readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly cards = computed<StatCard[]>(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      { label: 'admin.stats.pending', value: stats.pending_submissions, link: '/admin/submissions' },
      { label: 'admin.stats.doctors', value: stats.doctors, link: '/admin/doctors' },
      { label: 'admin.stats.labs', value: stats.labs, link: '/admin/facilities' },
      { label: 'admin.stats.pharmacies', value: stats.pharmacies, link: '/admin/facilities' },
      { label: 'admin.stats.centers', value: stats.medical_centers, link: '/admin/facilities' },
      { label: 'admin.stats.ads', value: stats.active_advertisements, link: '/admin/advertisements' },
    ];
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.stats.set(await this.dashboard.stats());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
