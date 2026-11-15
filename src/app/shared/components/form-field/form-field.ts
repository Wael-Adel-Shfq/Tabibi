import { Component, computed, input, Signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** The part of a Signal Forms field this wrapper reads. */
export type FieldLike = () => {
  touched: Signal<boolean>;
  errors: Signal<readonly { kind: string }[]>;
};

/**
 * Label, hint and validation message around one projected native control.
 * The control itself is bound by the parent with `[formField]`.
 */
@Component({
  selector: 'app-form-field',
  imports: [TranslatePipe],
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
})
export class FormFieldWrapper {
  /** Translation key of the label. */
  readonly label = input.required<string>();
  /** `id` of the projected control, so the label is associated with it. */
  readonly for = input.required<string>();
  readonly field = input.required<FieldLike>();
  readonly required = input(false);
  /** Optional translation key of a hint shown under the control. */
  readonly hint = input('');

  /** Kind of the first error, shown once the visitor has left the field. */
  protected readonly errorKind = computed(() => {
    const state = this.field()();
    return state.touched() ? (state.errors()[0]?.kind ?? null) : null;
  });
}
