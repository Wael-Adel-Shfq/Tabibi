import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { CHILD_KINDS, Location, LocationKind, TWO_LEVEL_GOVERNORATES } from '../../../core/models/entities';
import { LocationsService } from '../../../features/locations/locations.service';
import { SearchSelect, SelectOption } from '../search-select/search-select';

const ROOT = 'root';
/** Options-map key prefix for the one-list places of a two-level governorate. */
const FLAT = 'flat:';
/** Options-map key of the country-wide places list (`directPlaces`). */
const ALL = 'all';

interface Level {
  index: number;
  /** Location whose children this level lists (null for the governorates). */
  parent: Location | null;
  options: Location[];
  /** The options as shown in the dropdown. */
  choices: SelectOption[];
  selected: string;
  /** Kinds this level can hold, used for the label (e.g. "District / Center"). */
  kinds: readonly LocationKind[];
  /** True while the options are still being fetched. */
  loading: boolean;
  /** Fixed label (translation key) instead of one built from `kinds`. */
  labelKey?: string;
  /** The country-wide places list shown before a governorate is chosen. */
  direct?: boolean;
}

/**
 * Cascading location dropdowns. Starts with the governorates and, after each
 * choice, shows the next level whenever one is possible, so Cairo shows
 * governorate → region → district → area and Minya shows
 * governorate → center → area (with `skipRegions`, Cairo shows
 * governorate → district / city → area). A level with nothing added yet is shown
 * disabled with a note; with `allowAdd`, every level below the governorates
 * also offers "+ Add a new place", reported through `addRequest`.
 *
 * With `twoLevel`, Cairo and Giza (TWO_LEVEL_GOVERNORATES) take just two
 * steps: the governorate, then one list of all its districts, cities and
 * neighbourhoods (regions left out), with no deeper level.
 *
 * With `directPlaces`, the second dropdown is there before any governorate
 * is chosen and lists every district, city and neighbourhood (with its
 * governorate), so a visitor can pick "مدينة نصر" directly; the governorate
 * and any levels between are then filled in from that place's path.
 *
 * `path` holds the chosen ids from the governorate down; picking an empty
 * option at a level truncates the path there. In a two-level governorate the
 * path is [governorate, place] (an existing record's longer path is read by
 * its last id).
 */
@Component({
  selector: 'app-location-picker',
  imports: [TranslatePipe, SearchSelect],
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
  /**
   * Hide the region level: a governorate with regions (Cairo) lists the
   * districts and cities of all its regions directly. Used on the public
   * pages; the admin keeps the full tree.
   */
  readonly skipRegions = input(false);
  /** Pick Cairo and Giza in two levels (governorate, then place); see the class doc. */
  readonly twoLevel = input(false);
  /** Offer every place in the country before a governorate is chosen; see the class doc. */
  readonly directPlaces = input(false);
  /** Emits the most specific chosen location after the visitor changes a level. */
  readonly selection = output<Location | null>();
  /** Emits the parent under which the visitor wants to add a missing place. */
  readonly addRequest = output<Location>();

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
        choices: this.toChoices(list),
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
      if (!chosen) {
        if (index === 0 && path.length === 0 && this.directPlaces()) {
          const all = options.get(ALL);
          levels.push({
            index: 1,
            parent: null,
            options: all ?? [],
            choices: this.toDirectChoices(all, list),
            selected: '',
            kinds: [],
            loading: all === undefined,
            labelKey: 'locations.placeLevel',
            direct: true,
          });
        }
        break;
      }
      if (this.isTwoLevel(chosen)) {
        const places = options.get(FLAT + chosen.id);
        levels.push({
          index: index + 1,
          parent: chosen,
          options: places ?? [],
          choices: this.toChoices(places),
          selected: path.length > index + 1 ? (path.at(-1) ?? '') : '',
          kinds: [],
          loading: places === undefined,
          labelKey: 'locations.placeLevel',
        });
        break;
      }
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
      const path = this.path();
      const governorates = this.options().get(ROOT);
      untracked(() => {
        if (version !== seenVersion) {
          seenVersion = version;
          this.requested = new Set();
        }
        this.ensure(ROOT);
        if (this.directPlaces() && path.length === 0) this.ensure(ALL);
        // Until the governorates arrive we cannot tell whether the chosen one is two-level.
        if (!governorates || path.length === 0) return;
        const governorate = governorates.find((option) => option.id === path[0]);
        if (governorate && this.isTwoLevel(governorate)) {
          this.ensure(FLAT + governorate.id);
        } else {
          path.forEach((key) => this.ensure(key));
        }
      });
    });
  }

  /** Text of the empty choice (or the whole dropdown while it cannot be used). */
  protected placeholderFor(level: Level): string {
    if (level.loading) return 'common.loading';
    if (level.options.length === 0) return 'locations.noneYet';
    return this.mode() === 'filter' ? 'filters.all' : 'common.choose';
  }

  protected onAdd(level: Level): void {
    if (level.parent) this.addRequest.emit(level.parent);
  }

  protected onSelect(level: Level, value: string): void {
    if (level.direct) {
      // A place picked straight from the country-wide list: take its whole chain.
      const place = level.options.find((option) => option.id === value);
      if (!place) return;
      this.path.set([...place.path]);
      this.selection.emit(place);
      return;
    }
    const kept = this.path().slice(0, level.index);
    this.path.set(value ? [...kept, value] : kept);
    this.selection.emit(value ? (level.options.find((o) => o.id === value) ?? null) : level.parent);
  }

  private toChoices(list: Location[] | undefined): SelectOption[] {
    return (list ?? []).map((location) => ({ value: location.id, label: this.language.name(location) }));
  }

  /** Country-wide places labelled with where they are, e.g. "تونا الجبل — ملوي، المنيا". */
  private toDirectChoices(places: Location[] | undefined, governorates: Location[] | undefined): SelectOption[] {
    const byId = new Map<string, Location>();
    for (const location of [...(governorates ?? []), ...(places ?? [])]) byId.set(location.id, location);
    return (places ?? []).map((place) => {
      // Ancestors nearest first; regions are not in the list, so they drop out.
      const where = place.path
        .slice(0, -1)
        .reverse()
        .map((id) => byId.get(id))
        .filter((location): location is Location => location !== undefined)
        .map((location) => this.language.name(location));
      const name = this.language.name(place);
      return { value: place.id, label: where.length ? `${name} — ${where.join('، ')}` : name };
    });
  }

  private isTwoLevel(location: Location): boolean {
    return (
      this.twoLevel() && location.kind === 'governorate' && TWO_LEVEL_GOVERNORATES.has(location.name_en ?? '')
    );
  }

  private ensure(key: string): void {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    const parentId = key === ROOT ? null : key;
    const load = key === ALL
      ? this.locations.allPlaces()
      : key.startsWith(FLAT)
      ? this.locations.placesUnder(key.slice(FLAT.length))
      : this.skipRegions()
        ? this.locations.childrenSkippingRegions(parentId)
        : this.locations.children(parentId);
    load
      .then((list) => this.options.update((current) => new Map(current).set(key, list)))
      .catch(() => this.requested.delete(key));
  }
}
