import { Component, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { Doctor, PAGE_SIZE } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { PagedList } from '../../../../shared/utils/paged-list';
import { DoctorsService } from '../../../doctors/doctors.service';
import { LocationsService } from '../../../locations/locations.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { DoctorDialog, DoctorDialogData } from '../doctor-dialog/doctor-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-doctors-admin',
  imports: [
    MatButtonModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './doctors-admin.html',
  styleUrl: './doctors-admin.css',
})
export class DoctorsAdmin {
  private readonly doctors = inject(DoctorsService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly term = signal('');
  protected readonly governorateId = signal('');
  protected readonly specialtyId = signal('');
  protected readonly status = signal<StatusFilter>('all');

  protected readonly list = new PagedList<Doctor>((page) =>
    this.doctors.search({
      term: this.term(),
      governorateId: this.governorateId(),
      specialtyId: this.specialtyId(),
      status: this.status(),
      page,
    }),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.locations.load().catch(() => undefined);

    effect(() => {
      this.term();
      this.governorateId();
      this.specialtyId();
      this.status();
      untracked(() => void this.list.reload());
    });
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.term.set(value.trim()), 300);
  }

  protected onGovernorate(event: Event): void {
    this.governorateId.set((event.target as HTMLSelectElement).value);
  }

  protected onSpecialty(event: Event): void {
    this.specialtyId.set((event.target as HTMLSelectElement).value);
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected onPage(event: PageEvent): void {
    void this.list.goTo(event.pageIndex);
  }

  protected async edit(doctor?: Doctor): Promise<void> {
    const saved = await this.dialogs.open<DoctorDialogData, boolean>(DoctorDialog, { doctor });
    if (saved) {
      await this.toast.success('common.saved');
      await this.list.refresh();
    }
  }

  protected async toggle(doctor: Doctor, isActive: boolean): Promise<void> {
    try {
      await this.doctors.setActive(doctor.id, isActive);
      await this.toast.success(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }

  protected async remove(doctor: Doctor): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.doctors.deleteTitle',
      subject: doctor.full_name,
      message: 'admin.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.doctors.remove(doctor.id);
      await this.toast.success('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }
}
