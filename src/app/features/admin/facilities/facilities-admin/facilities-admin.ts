import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { FACILITY_TYPES, Facility, FacilityType, PAGE_SIZE } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { LocationPicker } from '../../../../shared/components/location-picker/location-picker';
import { PagedList } from '../../../../shared/utils/paged-list';
import { FacilitiesService } from '../../../facilities/facilities.service';
import { LocationsService } from '../../../locations/locations.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { FacilityDialog, FacilityDialogData } from '../facility-dialog/facility-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

/** One management page for laboratories, pharmacies and medical centers. */
@Component({
  selector: 'app-facilities-admin',
  imports: [
    MatButtonModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
    LocationPicker,
  ],
  templateUrl: './facilities-admin.html',
  styleUrl: './facilities-admin.css',
})
export class FacilitiesAdmin {
  private readonly facilities = inject(FacilitiesService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly types = FACILITY_TYPES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly term = signal('');
  protected readonly type = signal<FacilityType | ''>('');
  protected readonly locationPath = signal<string[]>([]);
  private readonly locationId = computed(() => this.locationPath().at(-1) ?? '');
  protected readonly status = signal<StatusFilter>('all');

  protected readonly list = new PagedList<Facility>((page) =>
    this.facilities.search({
      term: this.term(),
      type: this.type(),
      locationId: this.locationId(),
      status: this.status(),
      page,
    }),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.locations.load().catch(() => undefined);

    effect(() => {
      this.term();
      this.type();
      this.locationId();
      this.status();
      untracked(() => void this.list.reload());
    });
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.term.set(value.trim()), 300);
  }

  protected onType(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value as FacilityType | '');
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected onPage(event: PageEvent): void {
    void this.list.goTo(event.pageIndex);
  }

  protected async edit(facility?: Facility): Promise<void> {
    const saved = await this.dialogs.open<FacilityDialogData, boolean>(FacilityDialog, {
      facility,
      type: this.type() || undefined,
    });
    if (saved) {
      await this.toast.success('common.saved');
      await this.list.refresh();
    }
  }

  protected async toggle(facility: Facility, isActive: boolean): Promise<void> {
    try {
      await this.facilities.setActive(facility.id, isActive);
      await this.toast.success(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }

  protected async remove(facility: Facility): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.facilities.deleteTitle',
      subject: facility.name,
      message: 'admin.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.facilities.remove(facility.id);
      await this.toast.success('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }
}
