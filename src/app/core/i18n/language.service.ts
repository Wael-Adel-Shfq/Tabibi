import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Service, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { Named } from '../models/entities';

export type Lang = 'ar' | 'en';

const STORAGE_KEY = 'tabibi.lang';

/** Current UI language; keeps `<html lang dir>` and ngx-translate in sync. */
@Service()
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);

  private readonly langState = signal<Lang>(this.stored());

  readonly lang = this.langState.asReadonly();
  readonly dir = computed(() => (this.langState() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const lang = this.langState();
      this.translate.use(lang);
      const root = this.document.documentElement;
      root.lang = lang;
      root.dir = this.dir();
      try {
        this.document.defaultView?.localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Storage can be unavailable (private mode); the choice then lasts for the session.
      }
    });
  }

  toggle(): void {
    this.langState.update((lang) => (lang === 'ar' ? 'en' : 'ar'));
  }

  /** Name of a bilingual record in the current language, falling back to Arabic. */
  name(item: Named | null | undefined): string {
    if (!item) return '';
    return this.langState() === 'en' ? item.name_en || item.name_ar : item.name_ar;
  }

  private stored(): Lang {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  }
}
