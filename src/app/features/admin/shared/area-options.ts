import { signal } from '@angular/core';
import type { Area } from '../../../core/models/entities';
import type { LocationsService } from '../../locations/locations.service';

/**
 * Area choices for a form's governorate field. Forms call `load` when the
 * governorate changes so the area dropdown only offers matching areas.
 */
export class AreaOptions {
  private readonly areasState = signal<Area[]>([]);
  private current = '';

  readonly areas = this.areasState.asReadonly();

  constructor(private readonly locations: LocationsService) {}

  async load(governorateId: string): Promise<void> {
    this.current = governorateId;
    this.areasState.set([]);
    if (!governorateId) return;
    try {
      const areas = await this.locations.areasOf(governorateId);
      // Ignore a response for a governorate the admin has already moved away from.
      if (this.current === governorateId) this.areasState.set(areas);
    } catch {
      this.areasState.set([]);
    }
  }
}

/** Shared coordinate rules: a decimal number, and both values or neither. */
export const COORDINATE_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

export function toCoordinate(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}
