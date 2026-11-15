import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, pattern, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import type { Area, Lookup } from '../../../../core/models/entities';
import { orNull } from '../../../../core/supabase/unwrap';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { LocationsService } from '../../../locations/locations.service';
import { LookupsAdminService, LookupTable } from '../../data/lookups-admin.service';
import { adminErrorKey } from '../../shared/admin-errors';

export interface LookupDialogData {
  table: LookupTable;
  /** Record to edit; omitted when adding. */
  item?: Lookup | Area;
  /** Preselected governorate when adding an area. */
  governorateId?: string;
}

@Component({
  selector: 'app-lookup-dialog',
  imports: [FormField, MatDialogModule, MatButtonModule, TranslatePipe, FormFieldWrapper],
  templateUrl: './lookup-dialog.html',
  styleUrl: './lookup-dialog.css',
})
export class LookupDialog {
  protected readonly data = inject<LookupDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<LookupDialog, boolean>>(MatDialogRef);
  private readonly lookups = inject(LookupsAdminService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly isArea = this.data.table === 'areas';
  protected readonly failure = signal<string | null>(null);

  protected readonly model = signal({
    governorate_id: (this.data.item as Area | undefined)?.governorate_id ?? this.data.governorateId ?? '',
    name_ar: this.data.item?.name_ar ?? '',
    name_en: this.data.item?.name_en ?? '',
    sort_order: String(this.data.item?.sort_order ?? 0),
    is_active: this.data.item?.is_active ?? true,
  });

  protected readonly lookup = form(this.model, (path) => {
    required(path.governorate_id, { when: () => this.isArea });
    required(path.name_ar);
    minLength(path.name_ar, 2);
    maxLength(path.name_ar, 80);
    // English names are optional for areas only.
    required(path.name_en, { when: () => !this.isArea });
    maxLength(path.name_en, 80);
    required(path.sort_order);
    pattern(path.sort_order, /^\d{1,6}$/);
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.lookup, async () => {
      const value = this.model();
      try {
        await this.lookups.save(
          this.data.table,
          {
            name_ar: value.name_ar.trim(),
            name_en: this.isArea ? orNull(value.name_en) : value.name_en.trim(),
            sort_order: Number(value.sort_order),
            is_active: value.is_active,
            ...(this.isArea ? { governorate_id: value.governorate_id } : {}),
          },
          this.data.item?.id,
        );
        this.ref.close(true);
      } catch (error) {
        this.failure.set(adminErrorKey(error));
      }
      return undefined;
    });
  }
}
