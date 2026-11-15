import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
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
import { AD_PLACEMENTS, AdPlacement, Advertisement, Location } from '../../../../core/models/entities';
import { orNull } from '../../../../core/supabase/unwrap';
import { FieldGroup } from '../../../../shared/components/field-group/field-group';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { LocationPicker } from '../../../../shared/components/location-picker/location-picker';
import { LocationField } from '../../../../shared/utils/location-field';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { AD_IMAGE_TYPES } from '../../../../shared/utils/image';
import { PHONE_PATTERN, URL_PATTERN } from '../../../../shared/utils/validation';
import { AdsService, ImageRejectedError } from '../../../advertisements/ads.service';
import { LocationsService } from '../../../locations/locations.service';
import { adminErrorKey } from '../../shared/admin-errors';

export interface AdDialogData {
  ad?: Advertisement;
}

/** `datetime-local` value (local time, minutes) for an ISO timestamp. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

@Component({
  selector: 'app-ad-dialog',
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
  templateUrl: './ad-dialog.html',
  styleUrl: './ad-dialog.css',
})
export class AdDialog {
  protected readonly data = inject<AdDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AdDialog, boolean>>(MatDialogRef);
  private readonly ads = inject(AdsService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly placements = AD_PLACEMENTS;
  protected readonly accept = AD_IMAGE_TYPES.join(',');
  /** Optional targeting; any level, or none for everywhere. */
  protected readonly location = new LocationField(this.data.ad);
  protected readonly ready = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** Newly picked file, uploaded only when the form is saved. */
  private readonly file = signal<File | null>(null);
  private readonly preview = signal<string | null>(null);
  protected readonly imageSrc = computed(
    () => this.preview() ?? (this.data.ad ? this.ads.imageUrl(this.data.ad.image_path) : null),
  );
  protected readonly imageMissing = signal(false);

  protected readonly model = signal({
    title: this.data.ad?.title ?? '',
    advertiser_name: this.data.ad?.advertiser_name ?? '',
    placement: (this.data.ad?.placement ?? 'home_top') as string,
    display_order: String(this.data.ad?.display_order ?? 0),
    location_id: this.data.ad?.location_id ?? '',
    address: this.data.ad?.address ?? '',
    phone: this.data.ad?.phone ?? '',
    map_url: this.data.ad?.map_url ?? '',
    starts_at: toLocalInput(this.data.ad?.starts_at),
    ends_at: toLocalInput(this.data.ad?.ends_at),
    is_active: this.data.ad?.is_active ?? true,
  });

  protected readonly ad = form(this.model, (path) => {
    required(path.title);
    minLength(path.title, 2);
    maxLength(path.title, 120);
    required(path.advertiser_name);
    minLength(path.advertiser_name, 2);
    maxLength(path.advertiser_name, 120);
    required(path.placement);
    required(path.display_order);
    pattern(path.display_order, /^\d{1,6}$/);
    maxLength(path.address, 300);
    pattern(path.phone, PHONE_PATTERN);
    pattern(path.map_url, URL_PATTERN);
    validate(path.ends_at, ({ value, valueOf }) => {
      const start = valueOf(path.starts_at);
      return value() && start && value() <= start ? { kind: 'endBeforeStart' } : null;
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
    void this.prepare();
  }

  private async prepare(): Promise<void> {
    await this.locations.load().catch(() => undefined);
    this.ready.set(true);
  }

  protected onLocation(location: Location | null): void {
    const locationId = this.location.select(location);
    this.model.update((value) => ({ ...value, location_id: locationId }));
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.failure.set(null);
    this.revokePreview();
    if (file && !AD_IMAGE_TYPES.includes(file.type)) {
      this.file.set(null);
      this.failure.set('admin.ads.imageType');
      return;
    }
    this.file.set(file);
    this.preview.set(file ? URL.createObjectURL(file) : null);
    this.imageMissing.set(false);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    if (!this.data.ad && !this.file()) {
      this.imageMissing.set(true);
    }
    await submit(this.ad, async () => {
      if (this.imageMissing()) return undefined;
      await this.save();
      return undefined;
    });
  }

  private async save(): Promise<void> {
    const value = this.model();
    const previousPath = this.data.ad?.image_path ?? null;
    let uploadedPath: string | null = null;
    try {
      const file = this.file();
      if (file) uploadedPath = await this.ads.uploadImage(file);

      await this.ads.save(
        {
          title: value.title.trim(),
          advertiser_name: value.advertiser_name.trim(),
          image_path: uploadedPath ?? previousPath ?? '',
          placement: value.placement as AdPlacement,
          display_order: Number(value.display_order),
          location_id: orNull(value.location_id),
          address: orNull(value.address),
          phone: orNull(value.phone),
          map_url: orNull(value.map_url),
          starts_at: fromLocalInput(value.starts_at),
          ends_at: fromLocalInput(value.ends_at),
          is_active: value.is_active,
        },
        this.data.ad?.id,
      );

      // The replaced image is no longer referenced by any advertisement.
      if (uploadedPath && previousPath && previousPath !== uploadedPath) {
        await this.ads.removeImage(previousPath);
      }
      this.ref.close(true);
    } catch (error) {
      // Do not leave an orphaned upload behind when the row could not be saved.
      if (uploadedPath) await this.ads.removeImage(uploadedPath);
      this.failure.set(
        error instanceof ImageRejectedError ? 'admin.ads.image' + (error.reason === 'type' ? 'Type' : 'Size') : adminErrorKey(error),
      );
    }
  }

  private revokePreview(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }
}
