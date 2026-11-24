import { Component, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { HealthTip } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { HealthTipsAdminService } from '../../data/health-tips-admin.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { TipDialog, TipDialogData } from '../tip-dialog/tip-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

/** Management page for the home page "tip of the day" (كل يوم معلومة). */
@Component({
  selector: 'app-tips-admin',
  imports: [MatButtonModule, MatSlideToggleModule, TranslatePipe, LoadingState, ErrorState, EmptyState],
  templateUrl: './tips-admin.html',
  styleUrl: './tips-admin.css',
})
export class TipsAdmin {
  private readonly tips = inject(HealthTipsAdminService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);

  protected readonly term = signal('');
  protected readonly status = signal<StatusFilter>('all');

  protected readonly rows = signal<HealthTip[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  private requestId = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
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
      const rows = await this.tips.list({ term: this.term(), status: this.status() });
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

  protected async edit(item?: HealthTip): Promise<void> {
    const saved = await this.dialogs.open<TipDialogData, boolean>(TipDialog, { item });
    if (saved) {
      await this.toast.success('common.saved');
      await this.load();
    }
  }

  protected async toggle(row: HealthTip, isActive: boolean): Promise<void> {
    try {
      await this.tips.setActive(row.id, isActive);
      await this.toast.success(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.load();
  }

  protected async remove(row: HealthTip): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.tips.deleteTitle',
      subject: row.text_ar,
      message: 'admin.tips.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.tips.remove(row.id);
      await this.toast.success('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.load();
  }
}
