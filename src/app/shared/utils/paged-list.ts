import { computed, signal } from '@angular/core';
import type { Page } from '../../core/models/entities';

/**
 * Loading, error and paging state for a server-paginated list. Used by the
 * public lists (append on scroll) and the admin tables (replace per page).
 */
export class PagedList<T> {
  private readonly itemsState = signal<T[]>([]);
  private readonly totalState = signal(0);
  private readonly pageState = signal(0);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);
  private readonly loadedState = signal(false);
  private requestId = 0;

  readonly items = this.itemsState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** True once the first request has completed successfully. */
  readonly loaded = this.loadedState.asReadonly();
  readonly empty = computed(() => this.loadedState() && this.itemsState().length === 0);
  readonly hasMore = computed(() => this.itemsState().length < this.totalState());

  constructor(private readonly fetchPage: (page: number) => Promise<Page<T>>) {}

  /** Loads the first page, replacing what is shown. */
  reload(): Promise<void> {
    return this.load(0, false);
  }

  /** Loads one page, replacing what is shown (admin tables). */
  goTo(page: number): Promise<void> {
    return this.load(page, false);
  }

  /** Reloads the page currently shown, e.g. after an edit. */
  refresh(): Promise<void> {
    return this.load(this.pageState(), false);
  }

  /** Appends the next page (infinite scroll). */
  loadMore(): Promise<void> {
    if (!this.hasMore() || this.loadingState()) return Promise.resolve();
    return this.load(this.pageState() + 1, true);
  }

  private async load(page: number, append: boolean): Promise<void> {
    // A newer request supersedes older ones, so a slow response cannot
    // overwrite the results of a later filter change.
    const id = ++this.requestId;
    this.loadingState.set(true);
    this.errorState.set(false);
    try {
      const result = await this.fetchPage(page);
      if (id !== this.requestId) return;
      this.itemsState.update((current) => (append ? [...current, ...result.items] : result.items));
      this.totalState.set(result.total);
      this.pageState.set(page);
      this.loadedState.set(true);
    } catch {
      if (id !== this.requestId) return;
      this.errorState.set(true);
    } finally {
      if (id === this.requestId) this.loadingState.set(false);
    }
  }
}
