import { Component, inject, input } from '@angular/core';
import { DirectoryFilterStore } from '../../../features/locations/location-filter.store';
import { LocationPicker } from '../location-picker/location-picker';

/** Location dropdowns bound to the visitor's shared directory filter. */
@Component({
  selector: 'app-location-filter',
  imports: [LocationPicker],
  templateUrl: './location-filter.html',
  styleUrl: './location-filter.css',
})
export class LocationFilter {
  protected readonly filter = inject(DirectoryFilterStore);

  /** Prefix for the dropdown ids; must be unique on the page. */
  readonly idPrefix = input('filter-location');
}
