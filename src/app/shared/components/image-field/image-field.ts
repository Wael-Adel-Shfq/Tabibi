import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ImageChange } from '../../../core/storage/image-storage.service';
import { IMAGE_TYPES } from '../../utils/image';

/**
 * Optional image picker with a preview. The file is only uploaded when the
 * host form saves (read `change()`), so cancelling a form leaves no orphan.
 */
@Component({
  selector: 'app-image-field',
  imports: [TranslatePipe],
  templateUrl: './image-field.html',
  styleUrl: './image-field.css',
})
export class ImageField {
  /** Unique id for the file input. */
  readonly inputId = input.required<string>();
  /** Translation key of the label. */
  readonly label = input('fields.image');
  /** Translation key of the hint under the input. */
  readonly hint = input('');
  /** URL of the image currently saved on the record, if any. */
  readonly currentUrl = input<string | null>(null);
  /** Alt text for the preview. */
  readonly alt = input('');

  protected readonly accept = IMAGE_TYPES.join(',');
  private readonly picked = signal<File | null>(null);
  private readonly previewUrl = signal<string | null>(null);
  private readonly removed = signal(false);
  protected readonly typeError = signal(false);

  /** The pending decision for the host form. */
  readonly change = computed<ImageChange>(() => {
    const file = this.picked();
    if (file) return { action: 'replace', file };
    return this.removed() ? { action: 'remove' } : { action: 'keep' };
  });

  protected readonly shown = computed(() => this.previewUrl() ?? (this.removed() ? null : this.currentUrl()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.typeError.set(false);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      this.typeError.set(true);
      input.value = '';
      return;
    }
    this.revoke();
    this.picked.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.removed.set(false);
  }

  protected clear(input: HTMLInputElement): void {
    this.revoke();
    this.picked.set(null);
    this.removed.set(true);
    input.value = '';
  }

  private revoke(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }
}
