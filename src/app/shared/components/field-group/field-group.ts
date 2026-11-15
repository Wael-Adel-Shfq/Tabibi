import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { FieldLike } from '../form-field/form-field';

/**
 * Fieldset version of `app-form-field` for inputs made of several controls
 * (such as the cascading location picker): a legend names the group, and the
 * field's first validation error is shown below it.
 */
@Component({
  selector: 'app-field-group',
  imports: [TranslatePipe],
  templateUrl: './field-group.html',
  styleUrl: './field-group.css',
})
export class FieldGroup {
  /** Translation key of the legend. */
  readonly legend = input.required<string>();
  readonly field = input.required<FieldLike>();
  readonly required = input(false);
  /** Optional translation key of a hint shown under the controls. */
  readonly hint = input('');

  protected readonly errorKind = computed(() => {
    const state = this.field()();
    return state.touched() ? (state.errors()[0]?.kind ?? null) : null;
  });
}
