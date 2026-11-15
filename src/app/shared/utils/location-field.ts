import { signal } from '@angular/core';
import { isTooBroad, Location, LocationKind, Placed } from '../../core/models/entities';

/**
 * State behind a form's location picker: the chosen chain and the kind of
 * its last step. Forms store `location_id` in their Signal Forms model and
 * validate it with `tooBroad()`.
 */
export class LocationField {
  readonly path = signal<string[]>([]);
  readonly kind = signal<LocationKind | null>(null);

  constructor(record?: Placed | null) {
    if (record?.location_id) {
      this.path.set([...record.location_path]);
      this.kind.set(record.location_chain?.at(-1)?.kind ?? null);
    }
  }

  /** Call from the picker's `selection` output; returns the new location id ('' when none). */
  select(location: Location | null): string {
    this.kind.set(location?.kind ?? null);
    return location?.id ?? '';
  }

  reset(): void {
    this.path.set([]);
    this.kind.set(null);
  }

  tooBroad(): boolean {
    return isTooBroad(this.kind());
  }
}
