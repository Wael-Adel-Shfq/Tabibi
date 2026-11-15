import { Component, effect, inject, untracked } from '@angular/core';
import { IonContent, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Doctor } from '../../../core/models/entities';
import { AdSlot } from '../../../shared/components/ad-slot/ad-slot';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { LocationFilter } from '../../../shared/components/location-filter/location-filter';
import { PublicHeader } from '../../../shared/components/public-header/public-header';
import { PagedList } from '../../../shared/utils/paged-list';
import { DirectoryFilterStore } from '../../locations/location-filter.store';
import { LocationsService } from '../../locations/locations.service';
import { DoctorCard } from '../doctor-card/doctor-card';
import { DoctorsService } from '../doctors.service';

@Component({
  selector: 'app-doctors-list',
  imports: [
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TranslatePipe,
    PublicHeader,
    LocationFilter,
    AdSlot,
    DoctorCard,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './doctors-list.html',
  styleUrl: './doctors-list.css',
})
export class DoctorsList {
  private readonly doctors = inject(DoctorsService);
  protected readonly locations = inject(LocationsService);
  protected readonly filter = inject(DirectoryFilterStore);
  protected readonly language = inject(LanguageService);

  protected readonly list = new PagedList<Doctor>((page) =>
    this.doctors.search({
      term: this.filter.doctorTerm(),
      specialtyId: this.filter.specialtyId(),
      locationId: this.filter.locationId(),
      page,
    }),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.locations.load().catch(() => undefined);

    // Any filter change restarts the list from the first page.
    effect(() => {
      this.filter.doctorTerm();
      this.filter.specialtyId();
      this.filter.locationId();
      untracked(() => void this.list.reload());
    });
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.filter.doctorTerm.set(value.trim()), 350);
  }

  protected onSpecialty(event: Event): void {
    this.filter.specialtyId.set((event.target as HTMLSelectElement).value);
  }

  protected async onInfinite(event: Event): Promise<void> {
    await this.list.loadMore();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }
}
