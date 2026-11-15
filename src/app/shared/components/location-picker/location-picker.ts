import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { CHILD_KINDS, Location, LocationKind } from '../../../core/models/entities';
import { LocationsService } from '../../../features/locations/locations.service';

const ROOT = 'root';
/** Value of the "add a new place" option; never a real id. */
const ADD = '__add__';

interface Level {
  index: number;
  /** Location whose children this level lists (null for the governorates). */
  parent: Location | null;
  options: Location[];
  selected: string;
  /** Kinds this level can hold, used for the label (e.g. "District / Center"). */
  kinds: readonly LocationKind[];
  /** True while the options are still being fetched. */
  loading: boolean;
}

/**
 * Cascading location dropdowns. Starts with the governorates and, after each
 * choice, shows the next level whenever one is possible, so Cairo shows
 * governorate → region → district → area and Minya shows
 * governorate → center → area. A level with nothing added yet is shown
 * disabled with a note; with `allowAdd`, every level below the governorates
 * also offers "+ Add a new place", reported through `addRequest`.
 *
 * `path` holds the chosen ids from the governorate down; picking an empty
 * option at a level truncates the path there.
 */
@Component({
  selector: 'app-location-picker',
  imports: [TranslatePipe],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.css',
})
export class LocationPicker {
  private readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  readonly path = model<string[]>([]);
  /** Prefix for the generated element ids; must be unique on the page. */
  readonly idPrefix = input.required<string>();
  /** 'filter' offers "All" at every level; 'form' offers "Choose…". */
  readonly mode = input<'filter' | 'form'>('filter');
  readonly invalid = input(false);
  /** Offer "+ Add a new place" below the governorate level. */
  readonly allowAdd = input(false);
  /** Emits the most specific chosen location after the visitor changes a level. */
  readonly selection = output<Location | null>();
  /** Emits the parent under which the visitor wants to add a missing place. */
  readonly addRequest = output<Location>();

  protected readonly addValue = ADD;

  private readonly options = signal<ReadonlyMap<string, Location[]>>(new Map());
  private requested = new Set<string>();

  protected readonly levels = computed<Level[]>(() => {
    const path = this.path();
    const options = this.options();
    const levels: Level[] = [];
    let parent: Location | null = null;
    for (let index = 0; ; index++) {
      const key = parent?.id ?? ROOT;
      const list = options.get(key);
      const kinds = CHILD_KINDS[parent?.kind ?? 'root'];
      if (kinds.length === 0) break;
      levels.push({
        index,
        parent,
        options: list ?? [],
        selected: path[index] ?? '',
        // With nothing added yet, label by what could go here; regions are a
        // Cairo-only level that is already seeded, so leave them out.
        kinds:
          list && list.length > 0
            ? [...new Set(list.map((location) => location.kind))]
            : kinds.filter((kind) => kind !== 'region'),
        loading: list === undefined,
      });
      const chosen = list?.find((option) => option.id === path[index]);
      if (!chosen) break;
      parent = chosen;
    }
    return levels;
  });

  constructor() {
    // Load the options of every level on the current path (also restores an
    // existing selection when editing a record), and reload after the cache
    // is dropped (for example when an admin adds a place).
    let seenVersion = this.locations.version();
    effect(() => {
      const version = this.locations.version();
      const keys = [ROOT, ...this.path()];
      untracked(() => {
        if (version !== seenVersion) {
          seenVersion = version;
          this.requested = new Set();
        }
        keys.forEach((key) => this.ensure(key));
      });
    });
  }

  protected onSelect(level: Level, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;

    if (value === ADD) {
      // Not a real choice: restore the previous value and ask the host to add one.
      select.value = level.selected;
      if (level.parent) this.addRequest.emit(level.parent);
      return;
    }

    const kept = this.path().slice(0, level.index);
    this.path.set(value ? [...kept, value] : kept);
    this.selection.emit(value ? (level.options.find((o) => o.id === value) ?? null) : level.parent);
  }

  private ensure(key: string): void {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    this.locations
      .children(key === ROOT ? null : key)
      .then((list) => this.options.update((current) => new Map(current).set(key, list)))
      .catch(() => this.requested.delete(key));
  }
}
