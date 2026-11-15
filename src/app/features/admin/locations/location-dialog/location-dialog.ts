import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, pattern, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { CHILD_KINDS, Location, LocationKind } from '../../../../core/models/entities';
import { orNull } from '../../../../core/supabase/unwrap';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { LocationsAdminService } from '../../data/locations-admin.service';
import { adminErrorKey } from '../../shared/admin-errors';

export interface LocationDialogData {
  /** Level being browsed; new locations are created under it (null = governorates). */
  parent: Location | null;
  /** Location to edit; omitted when adding. */
  item?: Location;
  /** Suggested Arabic name for a new location (e.g. a visitor's proposal). */
  name?: string;
}

@Component({
  selector: 'app-location-dialog',
  imports: [FormField, MatDialogModule, MatButtonModule, TranslatePipe, FormFieldWrapper],
  templateUrl: './location-dialog.html',
  styleUrl: './location-dialog.css',
})
export class LocationDialog {
  protected readonly data = inject<LocationDialogData>(MAT_DIALOG_DATA);
  /** Closes with the saved location. */
  private readonly ref = inject<MatDialogRef<LocationDialog, Location>>(MatDialogRef);
  private readonly admin = inject(LocationsAdminService);
  protected readonly language = inject(LanguageService);

  /** Kinds allowed at this level of the tree. */
  protected readonly kinds: readonly LocationKind[] = CHILD_KINDS[this.data.parent?.kind ?? 'root'];
  /** Default type for a new place: regions are a Cairo-only level, so prefer the next one. */
  private readonly defaultKind = this.kinds.find((kind) => kind !== 'region') ?? this.kinds[0];
  protected readonly isGovernorate = (this.data.item?.kind ?? this.defaultKind) === 'governorate';
  /** Where an existing location may be moved to (editing only). */
  protected readonly parents = signal<Location[]>([]);
  protected readonly failure = signal<string | null>(null);

  protected readonly model = signal({
    kind: (this.data.item?.kind ?? this.defaultKind) as string,
    parent_id: this.data.item?.parent_id ?? this.data.parent?.id ?? '',
    name_ar: this.data.item?.name_ar ?? this.data.name ?? '',
    name_en: this.data.item?.name_en ?? '',
    sort_order: String(this.data.item?.sort_order ?? 0),
    is_active: this.data.item?.is_active ?? true,
  });

  protected readonly location = form(this.model, (path) => {
    required(path.kind);
    required(path.name_ar);
    minLength(path.name_ar, 2);
    maxLength(path.name_ar, 80);
    required(path.name_en, { when: () => this.isGovernorate });
    maxLength(path.name_en, 80);
    required(path.sort_order);
    pattern(path.sort_order, /^\d{1,6}$/);
  });

  constructor() {
    const item = this.data.item;
    if (item && item.kind !== 'governorate') {
      this.admin
        .possibleParents(item)
        .then((parents) => this.parents.set(parents))
        .catch(() => this.parents.set([]));
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.location, async () => {
      const value = this.model();
      try {
        const saved = await this.admin.save(
          {
            parent_id: this.isGovernorate ? null : value.parent_id,
            kind: value.kind as LocationKind,
            name_ar: value.name_ar.trim(),
            name_en: orNull(value.name_en),
            sort_order: Number(value.sort_order),
            is_active: value.is_active,
          },
          this.data.item?.id,
        );
        this.ref.close(saved);
      } catch (error) {
        this.failure.set(adminErrorKey(error));
      }
      return undefined;
    });
  }
}
