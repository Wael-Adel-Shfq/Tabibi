import { computed, Service, signal } from '@angular/core';
import type { FacilityType } from '../../core/models/entities';

/**
 * The visitor's current directory filters. Shared by the home page and the
 * doctor and facility lists so a choice made on one tab follows them to the
 * next (for example, searching from the home page opens the doctors list
 * already filtered).
 */
@Service()
export class DirectoryFilterStore {
  /** Chosen location chain, from the governorate down to the most specific level picked. */
  readonly locationPath = signal<string[]>([]);
  /** The most specific location picked, or '' for "everywhere". */
  readonly locationId = computed(() => this.locationPath().at(-1) ?? '');

  readonly doctorTerm = signal('');
  readonly specialtyId = signal('');
  readonly facilityTerm = signal('');
  readonly facilityType = signal<FacilityType>('lab');
}
