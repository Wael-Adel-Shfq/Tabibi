import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { FACILITY_TYPES, Facility, FacilityType, Location } from '../../../../core/models/entities';
import { orNull } from '../../../../core/supabase/unwrap';
import { FieldGroup } from '../../../../shared/components/field-group/field-group';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { LocationPicker } from '../../../../shared/components/location-picker/location-picker';
import { LocationField } from '../../../../shared/utils/location-field';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { PHONE_PATTERN, URL_PATTERN } from '../../../../shared/utils/validation';
import { FacilitiesService } from '../../../facilities/facilities.service';
import { LocationsService } from '../../../locations/locations.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { LocationQuickAdd } from '../../shared/location-quick-add.service';
import { COORDINATE_PATTERN, toCoordinate } from '../../shared/coordinates';

export interface FacilityDialogData {
  /** Facility to edit; omitted when adding. */
  facility?: Facility;
  /** Preselected type when adding. */
  type?: FacilityType;
}

@Component({
  selector: 'app-facility-dialog',
  imports: [
    FormField,
    MatDialogModule,
    MatButtonModule,
    TranslatePipe,
    FormFieldWrapper,
    FieldGroup,
    LocationPicker,
    LoadingState,
  ],
  templateUrl: './facility-dialog.html',
  styleUrl: './facility-dialog.css',
})
export class FacilityDialog {
  protected readonly data = inject<FacilityDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<FacilityDialog, boolean>>(MatDialogRef);
  private readonly facilities = inject(FacilitiesService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly types = FACILITY_TYPES;
  private readonly quickAdd = inject(LocationQuickAdd);
  protected readonly location = new LocationField(this.data.facility);
  protected readonly ready = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly model = signal({
    name: this.data.facility?.name ?? '',
    type: (this.data.facility?.type ?? this.data.type ?? 'lab') as string,
    location_id: this.data.facility?.location_id ?? '',
    address: this.data.facility?.address ?? '',
    phone: this.data.facility?.phone ?? '',
    map_url: this.data.facility?.map_url ?? '',
    latitude: this.data.facility?.latitude?.toString() ?? '',
    longitude: this.data.facility?.longitude?.toString() ?? '',
    is_active: this.data.facility?.is_active ?? true,
  });

  protected readonly facility = form(this.model, (path) => {
    required(path.name);
    minLength(path.name, 2);
    maxLength(path.name, 150);
    required(path.type);
    required(path.location_id);
    validate(path.location_id, () => (this.location.tooBroad() ? { kind: 'locationTooBroad' } : null));
    required(path.address);
    minLength(path.address, 3);
    maxLength(path.address, 300);
    pattern(path.phone, PHONE_PATTERN);
    pattern(path.map_url, URL_PATTERN);
    pattern(path.latitude, COORDINATE_PATTERN);
    pattern(path.longitude, COORDINATE_PATTERN);
    validate(path.longitude, ({ value, valueOf }) =>
      (value().trim() === '') === (valueOf(path.latitude).trim() === '')
        ? null
        : { kind: 'coordinatesPair' },
    );
  });

  constructor() {
    void this.prepare();
  }

  private async prepare(): Promise<void> {
    await this.locations.load().catch(() => undefined);
    this.ready.set(true);
  }

  /** Adds a missing place under `parent` and selects it. */
  protected async onAddRequest(parent: Location): Promise<void> {
    const created = await this.quickAdd.create(parent);
    if (!created) return;
    this.location.path.set([...created.path]);
    this.onLocation(created);
  }

  protected onLocation(location: Location | null): void {
    const locationId = this.location.select(location);
    this.model.update((value) => ({ ...value, location_id: locationId }));
    this.facility.location_id().markAsTouched();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.facility, async () => {
      const value = this.model();
      try {
        await this.facilities.save(
          {
            name: value.name.trim(),
            type: value.type as FacilityType,
            location_id: value.location_id,
            address: value.address.trim(),
            phone: orNull(value.phone),
            map_url: orNull(value.map_url),
            latitude: toCoordinate(value.latitude),
            longitude: toCoordinate(value.longitude),
            is_active: value.is_active,
          },
          this.data.facility?.id,
        );
        this.ref.close(true);
      } catch (error) {
        this.failure.set(adminErrorKey(error));
      }
      return undefined;
    });
  }
}
