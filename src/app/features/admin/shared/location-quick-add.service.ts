import { inject, Service } from '@angular/core';
import type { Location } from '../../../core/models/entities';
import { LocationsService } from '../../locations/locations.service';
import { LocationDialog, LocationDialogData } from '../locations/location-dialog/location-dialog';
import { AdminDialogs } from './admin-dialogs.service';

/**
 * Lets an admin add a missing district / center / city / area from inside
 * another form (doctor, facility, suggestion review) without leaving it.
 */
@Service()
export class LocationQuickAdd {
  private readonly dialogs = inject(AdminDialogs);
  private readonly locations = inject(LocationsService);

  /** Opens the location form under `parent`; resolves with the new place, or null if cancelled. */
  async create(parent: Location, name?: string): Promise<Location | null> {
    const created = await this.dialogs.open<LocationDialogData, Location>(LocationDialog, { parent, name });
    if (!created) return null;
    // Pickers showing this level reload and include the new place.
    this.locations.invalidate(parent.id);
    return created;
  }
}
