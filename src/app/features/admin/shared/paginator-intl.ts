import { inject, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/** Paginator labels in the current UI language. */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.apply();
    this.translate.onLangChange.subscribe(() => {
      this.apply();
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) return String(this.translate.instant('paginator.none'));
    const start = page * pageSize + 1;
    const end = Math.min(start + pageSize - 1, length);
    return String(this.translate.instant('paginator.range', { start, end, length }));
  };

  private apply(): void {
    this.itemsPerPageLabel = String(this.translate.instant('paginator.perPage'));
    this.nextPageLabel = String(this.translate.instant('paginator.next'));
    this.previousPageLabel = String(this.translate.instant('paginator.previous'));
    this.firstPageLabel = String(this.translate.instant('paginator.first'));
    this.lastPageLabel = String(this.translate.instant('paginator.last'));
  }
}
