import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, optionsOutline, searchOutline } from 'ionicons/icons';
import { LanguageService } from '../../../core/i18n/language.service';
import { DirectoryFilterStore } from '../../../features/locations/location-filter.store';
import { LocationsService } from '../../../features/locations/locations.service';
import { LocationFilter } from '../location-filter/location-filter';
import { SearchSelect } from '../search-select/search-select';

/**
 * Rounded search field with a filter button beside it. The button opens a
 * bottom sheet with the specialty (doctors only) and location filters, which
 * write straight to the shared `DirectoryFilterStore`; a badge on the button
 * counts the filters in use.
 */
@Component({
  selector: 'app-directory-search',
  imports: [IonIcon, IonModal, TranslatePipe, LocationFilter, SearchSelect],
  templateUrl: './directory-search.html',
  styleUrl: './directory-search.css',
})
export class DirectorySearch {
  protected readonly filter = inject(DirectoryFilterStore);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  /** Id of the text field; also prefixes the ids inside the sheet. */
  readonly inputId = input.required<string>();
  /** Translation key of the (visually hidden) field label. */
  readonly label = input.required<string>();
  /** Translation key of the placeholder. */
  readonly placeholder = input.required<string>();
  readonly value = input('');
  /** Doctors can also be filtered by specialty; facilities by location only. */
  readonly kind = input<'doctors' | 'facilities'>('doctors');

  /** Every keystroke in the field. */
  readonly valueChange = output<string>();
  /** The visitor submitted the field or pressed "Show results" in the sheet. */
  readonly search = output<void>();

  protected readonly sheetOpen = signal(false);
  /** Set by "Show results"; the search runs once the sheet has finished closing. */
  private searchWhenClosed = false;

  protected readonly activeCount = computed(
    () =>
      (this.kind() === 'doctors' && this.filter.specialtyId() ? 1 : 0) +
      (this.filter.locationPath().length > 0 ? 1 : 0),
  );

  constructor() {
    addIcons({ searchOutline, optionsOutline, closeOutline });
    void this.locations.load().catch(() => undefined);
  }

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.search.emit();
  }

  protected clear(): void {
    if (this.kind() === 'doctors') this.filter.specialtyId.set('');
    this.filter.locationPath.set([]);
  }

  /**
   * Closes the sheet and searches once it has closed. Searching from the home
   * page switches to the doctors or facilities tab; doing that while the sheet
   * is still animating out left it stuck on screen (blocking scrolling on
   * every page), so the search waits for didDismiss.
   */
  protected showResults(): void {
    this.searchWhenClosed = true;
    this.sheetOpen.set(false);
  }

  protected onSheetDismissed(): void {
    this.sheetOpen.set(false);
    if (!this.searchWhenClosed) return;
    this.searchWhenClosed = false;
    this.search.emit();
  }
}
