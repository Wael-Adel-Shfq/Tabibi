import { Component, effect, inject, untracked } from '@angular/core';
import { IonContent, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { FACILITY_TYPES, Facility, FacilityType } from '../../../core/models/entities';
import { AdSlot } from '../../../shared/components/ad-slot/ad-slot';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { LocationFilter } from '../../../shared/components/location-filter/location-filter';
import { PublicHeader } from '../../../shared/components/public-header/public-header';
import { PagedList } from '../../../shared/utils/paged-list';
import { DirectoryFilterStore } from '../../locations/location-filter.store';
import { FacilitiesService } from '../facilities.service';
import { FacilityCard } from '../facility-card/facility-card';

/** One list for laboratories, pharmacies and medical centers, switched by type. */
@Component({
  selector: 'app-facilities-list',
  imports: [
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TranslatePipe,
    PublicHeader,
    LocationFilter,
    AdSlot,
    FacilityCard,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './facilities-list.html',
  styleUrl: './facilities-list.css',
})
export class FacilitiesList {
  private readonly facilities = inject(FacilitiesService);
  protected readonly filter = inject(DirectoryFilterStore);

  protected readonly types = FACILITY_TYPES;

  protected readonly list = new PagedList<Facility>((page) =>
    this.facilities.search({
      type: this.filter.facilityType(),
      term: this.filter.facilityTerm(),
      locationId: this.filter.locationId(),
      page,
    }),
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.filter.facilityType();
      this.filter.facilityTerm();
      this.filter.locationId();
      untracked(() => void this.list.reload());
    });
  }

  protected selectType(type: FacilityType): void {
    this.filter.facilityType.set(type);
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.filter.facilityTerm.set(value.trim()), 350);
  }

  protected async onInfinite(event: Event): Promise<void> {
    await this.list.loadMore();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }
}
