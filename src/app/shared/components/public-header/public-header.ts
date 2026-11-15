import { Component, inject, input } from '@angular/core';
import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';

/** Page header for the public app: title, optional back button, language switch. */
@Component({
  selector: 'app-public-header',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, TranslatePipe],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeader {
  protected readonly language = inject(LanguageService);

  /** Translation key of the page title. */
  readonly title = input.required<string>();
  /** When set, shows a back button that falls back to this URL. */
  readonly backHref = input('');
}
