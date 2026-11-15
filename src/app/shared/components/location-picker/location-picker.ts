import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Location, LocationKind } from '../../../core/models/entities';
import { LocationsService } from '../../../features/locations/locations.service';

const ROOT = 'root';

interface Level {
  index: number;
  options: Location[];
  selected: string;
  /** Kinds present at this level, used for the label (e.g. "District / Center"). */
  kinds: LocationKind[];
}

/**
 * Cascading location dropdowns. Starts with the governorates and adds the
 * next dropdown only when the chosen place has children, so Cairo shows
 * governorate → region → district → area and Minya shows
 * governorate → center → area.
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
  /** Emits the most specific chosen location after the visitor changes a level. */
  readonly selection = output<Location | null>();

  private readonly options = signal<ReadonlyMap<string, Location[]>>(new Map());
  private readonly requested = new Set<string>();

  protected readonly levels = computed<Level[]>(() => {
    const path = this.path();
    const options = this.options();
    const levels: Level[] = [];
    let parentKey = ROOT;
    for (let index = 0; ; index++) {
      const list = options.get(parentKey);
      if (!list || list.length === 0) break;
      levels.push({
        index,
        options: list,
        selected: path[index] ?? '',
        kinds: [...new Set(list.map((location) => location.kind))],
      });
      const chosen = path[index];
      if (!chosen) break;
      parentKey = chosen;
    }
    return levels;
  });

  constructor() {
    // Load the options of every level on the current path (also restores an
    // existing selection when editing a record).
    effect(() => {
      const keys = [ROOT, ...this.path()];
      untracked(() => keys.forEach((key) => this.ensure(key)));
    });
  }

  protected onSelect(level: Level, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const kept = this.path().slice(0, level.index);
    this.path.set(value ? [...kept, value] : kept);

    const chosenId = this.path().at(-1);
    const levelOfChosen = value ? level : this.levels()[level.index - 1];
    this.selection.emit(levelOfChosen?.options.find((option) => option.id === chosenId) ?? null);
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
