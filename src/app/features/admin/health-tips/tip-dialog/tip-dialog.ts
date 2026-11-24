import { Component, inject, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, pattern, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import type { HealthTip } from '../../../../core/models/entities';
import { FormFieldWrapper } from '../../../../shared/components/form-field/form-field';
import { HealthTipsAdminService } from '../../data/health-tips-admin.service';
import { adminErrorKey } from '../../shared/admin-errors';

export interface TipDialogData {
  /** Tip to edit; omitted when adding. */
  item?: HealthTip;
}

/** Add or edit one "tip of the day". */
@Component({
  selector: 'app-tip-dialog',
  imports: [FormField, MatDialogModule, MatButtonModule, TranslatePipe, FormFieldWrapper],
  templateUrl: './tip-dialog.html',
  styleUrl: './tip-dialog.css',
})
export class TipDialog {
  protected readonly data = inject<TipDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<TipDialog, boolean>>(MatDialogRef);
  private readonly tips = inject(HealthTipsAdminService);

  protected readonly failure = signal<string | null>(null);

  protected readonly model = signal({
    text_ar: this.data.item?.text_ar ?? '',
    text_en: this.data.item?.text_en ?? '',
    sort_order: String(this.data.item?.sort_order ?? 0),
    is_active: this.data.item?.is_active ?? true,
  });

  protected readonly tip = form(this.model, (path) => {
    required(path.text_ar);
    minLength(path.text_ar, 10);
    maxLength(path.text_ar, 300);
    minLength(path.text_en, 10);
    maxLength(path.text_en, 300);
    required(path.sort_order);
    pattern(path.sort_order, /^\d{1,6}$/);
  });

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.tip, async () => {
      const value = this.model();
      try {
        await this.tips.save(
          {
            text_ar: value.text_ar.trim(),
            text_en: value.text_en.trim() || null,
            sort_order: Number(value.sort_order),
            is_active: value.is_active,
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
