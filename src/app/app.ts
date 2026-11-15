import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Instantiated here so the document language and direction are applied at startup.
  private readonly language = inject(LanguageService);
}
