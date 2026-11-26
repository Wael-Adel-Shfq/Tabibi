import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { Platform } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { Subscription } from 'rxjs';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Priority of the Android back-button handler while the list is open: above
 * Ionic overlays (100), so back closes the list rather than the sheet or
 * dialog around it.
 */
const BACK_PRIORITY = 101;

/** Value used for the action row (e.g. "+ Add a new place"); never a real option. */
const ACTION = '__action__';

/**
 * Makes Arabic and English text comparable for searching: lower case, no
 * diacritics or tatweel, and the common letter variants folded together
 * (أ إ آ → ا, ة → ه, ى → ي).
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * Dropdown with a search box at the top of its list, for long lists such as
 * specialties and places (like PrimeNG's Select with `filter`). Works with
 * Signal Forms through `[formField]` or with `[(value)]`.
 *
 * Accessibility: the trigger is a button with role="combobox" (named by the
 * page's `<label for>`), the list is a listbox, and the search box drives it
 * with aria-activedescendant. Arrow keys move, Enter picks, Escape closes and
 * returns focus to the trigger.
 *
 * On touch screens the list opens without focusing the search box, so the
 * on-screen keyboard only appears when the visitor taps it; the field is then
 * scrolled to the top of its scroll area so the list stays above the keyboard.
 * The Android back button closes the open list.
 */
@Component({
  selector: 'app-search-select',
  imports: [TranslatePipe],
  templateUrl: './search-select.html',
  styleUrl: './search-select.css',
  host: {
    '(document:pointerdown)': 'onDocumentPointer($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class SearchSelect implements FormValueControl<string> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platform = inject(Platform);
  private backButton: Subscription | null = null;

  readonly value = model('');
  readonly options = input<readonly SelectOption[]>([]);
  /** Id of the trigger button; the page's `<label for>` points at it. */
  readonly inputId = input.required<string>();
  /** Translation key shown when nothing is chosen (e.g. "All", "Choose…"). */
  readonly placeholder = input('common.choose');
  /** Offer the placeholder as a choice that clears the value. */
  readonly clearable = input(true);
  /** Translation key of an extra row at the end of the list; picking it emits `action`. */
  readonly actionLabel = input<string | null>(null);
  readonly disabled = input(false);
  readonly invalid = input(false);
  /**
   * Set by Signal Forms, so a bound field is only marked invalid once the
   * visitor has left it (or tried to submit). Without a form, `invalid` is
   * shown as given.
   */
  readonly touched = input(true);
  protected readonly showInvalid = computed(() => this.invalid() && this.touched());
  readonly describedBy = input<string | null>(null);

  /** Emitted when the action row is picked; the value does not change. */
  readonly action = output<void>();
  /** Emitted after the visitor picks a value (not when it is set from outside). */
  readonly picked = output<string>();
  readonly touch = output<void>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private readonly listBox = viewChild<ElementRef<HTMLElement>>('listBox');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.releaseBackButton());
  }

  protected readonly open = signal(false);
  protected readonly query = signal('');
  /** Index of the highlighted row in `rows()`. */
  protected readonly active = signal(0);

  protected readonly listId = computed(() => this.inputId() + '-list');

  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? null,
  );

  /** What the list shows: the clear row, the matching options and the action row. */
  protected readonly rows = computed<SelectOption[]>(() => {
    const term = normalizeForSearch(this.query());
    const matches = term
      ? this.options().filter((option) => normalizeForSearch(option.label).includes(term))
      : this.options();
    const rows: SelectOption[] = [];
    if (this.clearable() && !term) rows.push({ value: '', label: '' });
    rows.push(...matches);
    if (this.actionLabel()) rows.push({ value: ACTION, label: '' });
    return rows;
  });

  protected readonly actionValue = ACTION;

  /** Lets Signal Forms move focus here, e.g. to the first invalid field. */
  focus(options?: FocusOptions): void {
    this.trigger().nativeElement.focus(options);
  }

  protected optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.show();
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && !this.open()) {
      event.preventDefault();
      this.show();
    }
  }

  /** Keys for the search box and the list (the list has focus on touch screens). */
  protected onListKey(event: KeyboardEvent): void {
    const count = this.rows().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveTo(Math.min(this.active() + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveTo(Math.max(this.active() - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this.moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.moveTo(count - 1);
        break;
      case 'Enter': {
        event.preventDefault();
        const row = this.rows()[this.active()];
        if (row) this.choose(row);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close(false);
        break;
    }
  }

  /** Once the keyboard is up, bring the field and its list into view above it. */
  protected onSearchFocus(): void {
    setTimeout(() => this.reveal(), 350);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected choose(row: SelectOption): void {
    if (row.value === ACTION) {
      this.close(true);
      this.action.emit();
      return;
    }
    this.value.set(row.value);
    this.picked.emit(row.value);
    this.close(true);
  }

  protected onDocumentPointer(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
      this.touch.emit();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    // Focus went nowhere (Android blurs this way during a touch-scroll or when
    // the keyboard closes) or to something around the dropdown (e.g. a modal
    // focusing itself). Keep the list open: taps outside are handled by
    // onDocumentPointer, and Tab / Escape / back close it.
    if (this.open() && (!next || next.contains(this.host.nativeElement))) return;
    this.close(false);
    this.touch.emit();
  }

  private show(): void {
    if (this.disabled()) return;
    this.query.set('');
    const index = this.rows().findIndex((row) => row.value === this.value() && row.value !== ACTION);
    this.active.set(Math.max(index, 0));
    this.open.set(true);
    this.backButton = this.platform.backButton.subscribeWithPriority(BACK_PRIORITY, () => this.close(true));
    // Wait for the panel to render before moving focus into it. On touch
    // screens focus the list, not the search box, so no keyboard pops up.
    setTimeout(() => {
      const touch = matchMedia('(pointer: coarse)').matches;
      const target = touch ? this.listBox() : this.searchBox();
      target?.nativeElement.focus({ preventScroll: true });
      this.scrollActiveIntoView();
      if (touch) this.reveal();
    });
  }

  private close(returnFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.releaseBackButton();
    if (returnFocus) this.trigger().nativeElement.focus({ preventScroll: true });
  }

  private releaseBackButton(): void {
    this.backButton?.unsubscribe();
    this.backButton = null;
  }

  /** Scrolls the field to the top of its scroll area so the open list fits below it. */
  private reveal(): void {
    if (this.open()) this.host.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  private moveTo(index: number): void {
    this.active.set(index);
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    const element = this.host.nativeElement.querySelector(`#${CSS.escape(this.optionId(this.active()))}`);
    element?.scrollIntoView({ block: 'nearest' });
  }
}
