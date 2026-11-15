import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Area } from '../../../core/models/entities';
import { DirectoryFilterStore } from '../../../features/locations/location-filter.store';
import { LocationsService } from '../../../features/locations/locations.service';

/**
 * Governorate and area pickers bound to the shared directory filter. The
 * area list always follows the selected governorate.
 */
@Component({
  selector: 'app-location-filter',
  imports: [TranslatePipe],
  templateUrl: './location-filter.html',
  styleUrl: './location-filter.css',
})
export class LocationFilter {
  protected readonly locations = inject(LocationsService);
  protected readonly filter = inject(DirectoryFilterStore);
  protected readonly language = inject(LanguageService);

  protected readonly areas = signal<Area[]>([]);

  constructor() {
    void this.locations.load().catch(() => undefined);

    effect((onCleanup) => {
      const governorateId = this.filter.governorateId();
      let cancelled = false;
      onCleanup(() => (cancelled = true));
      this.areas.set([]);
      if (!governorateId) return;
      this.locations
        .areasOf(governorateId)
        .then((areas) => {
          if (!cancelled) this.areas.set(areas);
        })
        .catch(() => undefined);
    });
  }

  protected onGovernorate(event: Event): void {
    this.filter.setGovernorate((event.target as HTMLSelectElement).value);
  }

  protected onArea(event: Event): void {
    this.filter.setArea((event.target as HTMLSelectElement).value);
  }
}
