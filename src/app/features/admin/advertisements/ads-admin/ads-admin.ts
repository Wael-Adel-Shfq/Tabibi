import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { AD_PLACEMENTS, AdPlacement, Advertisement, isPopupPlacement, PAGE_SIZE } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { PagedList } from '../../../../shared/utils/paged-list';
import { AdsService } from '../../../advertisements/ads.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { AdDialog, AdDialogData } from '../ad-dialog/ad-dialog';

@Component({
  selector: 'app-ads-admin',
  imports: [
    DatePipe,
    MatButtonModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './ads-admin.html',
  styleUrl: './ads-admin.css',
})
export class AdsAdmin {
  protected readonly ads = inject(AdsService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);

  protected readonly placements = AD_PLACEMENTS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly term = signal('');
  protected readonly placement = signal<AdPlacement | ''>('');
  protected readonly isPopup = isPopupPlacement;

  protected readonly list = new PagedList<Advertisement>((page) =>
    this.ads.list({ term: this.term(), placement: this.placement(), page }),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.term();
      this.placement();
      untracked(() => void this.list.reload());
    });
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.term.set(value.trim()), 300);
  }

  protected onPlacement(event: Event): void {
    this.placement.set((event.target as HTMLSelectElement).value as AdPlacement | '');
  }

  protected onPage(event: PageEvent): void {
    void this.list.goTo(event.pageIndex);
  }

  protected async edit(ad?: Advertisement): Promise<void> {
    const saved = await this.dialogs.open<AdDialogData, boolean>(AdDialog, { ad }, '720px');
    if (saved) {
      await this.toast.success('common.saved');
      await this.list.refresh();
    }
  }

  protected async toggle(ad: Advertisement, isActive: boolean): Promise<void> {
    try {
      await this.ads.setActive(ad.id, isActive);
      await this.toast.success(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }

  protected async remove(ad: Advertisement): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.ads.deleteTitle',
      subject: ad.title,
      message: 'admin.ads.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.ads.remove(ad);
      await this.toast.success('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }
}
