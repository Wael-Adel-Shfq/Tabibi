import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lookup } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { LocationsService } from '../../../locations/locations.service';
import { LookupsAdminService, LookupTable } from '../../data/lookups-admin.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { LookupDialog, LookupDialogData } from '../lookup-dialog/lookup-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Management page for a flat lookup table (currently specialties). The table
 * to manage comes from the route (`data: { table }`).
 */
@Component({
  selector: 'app-lookup-list',
  imports: [
    MatButtonModule,
    MatSlideToggleModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './lookup-list.html',
  styleUrl: './lookup-list.css',
})
export class LookupList {
  private readonly lookups = inject(LookupsAdminService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);
  private readonly locations = inject(LocationsService);

  /** Route data. */
  readonly table = input.required<LookupTable>();

  protected readonly term = signal('');
  protected readonly status = signal<StatusFilter>('all');

  protected readonly rows = signal<Lookup[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  private requestId = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.table();
      this.term();
      this.status();
      untracked(() => void this.load());
    });
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const rows = await this.lookups.list(this.table(), { term: this.term(), status: this.status() });
      if (id !== this.requestId) return;
      this.rows.set(rows);
    } catch {
      if (id === this.requestId) this.failed.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.term.set(value.trim()), 300);
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected async edit(item?: Lookup): Promise<void> {
    const saved = await this.dialogs.open<LookupDialogData, boolean>(LookupDialog, {
      table: this.table(),
      item,
    });
    if (saved) await this.afterChange('common.saved');
  }

  protected async toggle(row: Lookup, isActive: boolean): Promise<void> {
    try {
      await this.lookups.setActive(this.table(), row.id, isActive);
      await this.afterChange(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
      await this.load();
    }
  }

  private async afterChange(message: string): Promise<void> {
    await this.toast.success(message);
    // Public dropdowns read a cached copy of these tables.
    void this.locations.refresh().catch(() => undefined);
    await this.load();
  }
}
