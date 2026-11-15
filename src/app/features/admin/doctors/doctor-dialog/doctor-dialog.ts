import { Component, inject, signal, viewChild } from '@angular/core';
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
import type { Doctor, Location } from '../../../../core/models/entities';
import { orNull } from '../../../../core/supabase/unwrap';
import { ImageRejectedError } from '../../../../core/storage/image-storage.service';
import { FieldGroup } from '../../../../shared/components/field-group/field-group';
import { ImageField } from '../../../../shared/components/image-field/image-field';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { LocationPicker } from '../../../../shared/components/location-picker/location-picker';
import { LocationField } from '../../../../shared/utils/location-field';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { PHONE_PATTERN, URL_PATTERN } from '../../../../shared/utils/validation';
import { DoctorsService } from '../../../doctors/doctors.service';
import { LocationsService } from '../../../locations/locations.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { LocationQuickAdd } from '../../shared/location-quick-add.service';
import { COORDINATE_PATTERN, toCoordinate } from '../../shared/coordinates';

export interface DoctorDialogData {
  /** Doctor to edit; omitted when adding. */
  doctor?: Doctor;
}

@Component({
  selector: 'app-doctor-dialog',
  imports: [
    FormField,
    MatDialogModule,
    MatButtonModule,
    TranslatePipe,
    FormFieldWrapper,
    FieldGroup,
    ImageField,
    LocationPicker,
    LoadingState,
  ],
  templateUrl: './doctor-dialog.html',
  styleUrl: './doctor-dialog.css',
})
export class DoctorDialog {
  protected readonly data = inject<DoctorDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DoctorDialog, boolean>>(MatDialogRef);
  private readonly doctors = inject(DoctorsService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  private readonly quickAdd = inject(LocationQuickAdd);
  private readonly imageField = viewChild(ImageField);
  /** URL of the saved image, shown as the starting preview. */
  protected readonly currentImage = this.doctors.imageUrl(this.data.doctor?.image_path);
  protected readonly location = new LocationField(this.data.doctor);
  /** False until the dropdown options for the record being edited are loaded. */
  protected readonly ready = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly model = signal({
    full_name: this.data.doctor?.full_name ?? '',
    specialty_id: this.data.doctor?.specialty_id ?? '',
    clinic_phone: this.data.doctor?.clinic_phone ?? '',
    location_id: this.data.doctor?.location_id ?? '',
    address: this.data.doctor?.address ?? '',
    map_url: this.data.doctor?.map_url ?? '',
    latitude: this.data.doctor?.latitude?.toString() ?? '',
    longitude: this.data.doctor?.longitude?.toString() ?? '',
    is_active: this.data.doctor?.is_active ?? true,
  });

  protected readonly doctor = form(this.model, (path) => {
    required(path.full_name);
    minLength(path.full_name, 2);
    maxLength(path.full_name, 150);
    required(path.specialty_id);
    pattern(path.clinic_phone, PHONE_PATTERN);
    required(path.location_id);
    validate(path.location_id, () => (this.location.tooBroad() ? { kind: 'locationTooBroad' } : null));
    required(path.address);
    minLength(path.address, 3);
    maxLength(path.address, 300);
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
    this.doctor.location_id().markAsTouched();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.doctor, async () => {
      const value = this.model();
      try {
        await this.doctors.save(
          {
            full_name: value.full_name.trim(),
            specialty_id: value.specialty_id,
            clinic_phone: orNull(value.clinic_phone),
            location_id: value.location_id,
            address: value.address.trim(),
            map_url: orNull(value.map_url),
            latitude: toCoordinate(value.latitude),
            longitude: toCoordinate(value.longitude),
            is_active: value.is_active,
          },
          this.imageField()?.change() ?? { action: 'keep' },
          this.data.doctor,
        );
        this.ref.close(true);
      } catch (error) {
        this.failure.set(
          error instanceof ImageRejectedError
            ? error.reason === 'size'
              ? 'image.tooLarge'
              : 'image.badType'
            : adminErrorKey(error),
        );
      }
      return undefined;
    });
  }
}
