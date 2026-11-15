import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { CHILD_KINDS, Location } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { LocationsService } from '../../../locations/locations.service';
import { LocationsAdminService } from '../../data/locations-admin.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { LocationDialog, LocationDialogData } from '../location-dialog/location-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Browses the location tree one level at a time. `?parent=<id>` selects the
 * level, so the browser's back button walks back up the tree.
 */
@Component({
  selector: 'app-locations-admin',
  imports: [
    RouterLink,
    MatButtonModule,
    MatSlideToggleModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './locations-admin.html',
  styleUrl: './locations-admin.css',
})
export class LocationsAdmin {
  private readonly admin = inject(LocationsAdminService);
  private readonly publicLocations = inject(LocationsService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);
  protected readonly language = inject(LanguageService);

  /** Query parameter: the location whose children are listed ('' = governorates). */
  readonly parent = input<string | undefined>(undefined);

  protected readonly term = signal('');
  protected readonly status = signal<StatusFilter>('all');

  /** Breadcrumb from the governorate down to the current parent. */
  protected readonly trail = signal<Location[]>([]);
  protected readonly current = computed(() => this.trail().at(-1) ?? null);
  protected readonly canAdd = computed(() => CHILD_KINDS[this.current()?.kind ?? 'root'].length > 0);

  protected readonly rows = signal<Location[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  private requestId = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.parent();
      this.term();
      this.status();
      untracked(() => void this.load());
    });
  }

  protected hasChildren(location: Location): boolean {
    return CHILD_KINDS[location.kind].length > 0;
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    const parentId = this.parent() || null;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [trail, rows] = await Promise.all([
        parentId ? this.admin.chain(parentId) : Promise.resolve([]),
        this.admin.children(parentId, { term: this.term(), status: this.status() }),
      ]);
      if (id !== this.requestId) return;
      this.trail.set(trail);
      this.rows.set(rows);
    } catch {
      if (id === this.requestId) this.failed.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  protected onTerm(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.term.set(value.trim()), 300);
  }

  protected onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  protected async edit(item?: Location): Promise<void> {
    const saved = await this.dialogs.open<LocationDialogData, boolean>(LocationDialog, {
      parent: this.current(),
      item,
    });
    if (saved) await this.afterChange('common.saved');
  }

  protected async toggle(row: Location, isActive: boolean): Promise<void> {
    try {
      await this.admin.setActive(row.id, isActive);
      await this.afterChange(isActive ? 'common.activated' : 'common.deactivated');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
      await this.load();
    }
  }

  protected async remove(row: Location): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.locations.deleteTitle',
      subject: row.name_ar,
      message: 'admin.locations.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.admin.remove(row.id);
      await this.afterChange('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
  }

  private async afterChange(message: string): Promise<void> {
    await this.toast.success(message);
    // Public pickers read a cached copy of the tree.
    void this.publicLocations.refresh().catch(() => undefined);
    await this.load();
  }
}
