import { Service, signal } from '@angular/core';
import type { FacilityType } from '../../core/models/entities';

/**
 * The visitor's current directory filters. Shared by the home page and the
 * doctor and facility lists so a choice made on one tab follows them to the
 * next (for example, searching from the home page opens the doctors list
 * already filtered).
 */
@Service()
export class DirectoryFilterStore {
  private readonly governorateState = signal('');
  private readonly areaState = signal('');

  readonly governorateId = this.governorateState.asReadonly();
  readonly areaId = this.areaState.asReadonly();

  readonly doctorTerm = signal('');
  readonly specialtyId = signal('');
  readonly facilityTerm = signal('');
  readonly facilityType = signal<FacilityType>('lab');

  setGovernorate(id: string): void {
    if (id === this.governorateState()) return;
    this.governorateState.set(id);
    // An area only makes sense inside its governorate.
    this.areaState.set('');
  }

  setArea(id: string): void {
    this.areaState.set(id);
  }
}
