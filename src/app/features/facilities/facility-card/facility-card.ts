import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Facility } from '../../../core/models/entities';
import { ContactActions } from '../../../shared/components/contact-actions/contact-actions';

@Component({
  selector: 'app-facility-card',
  imports: [TranslatePipe, ContactActions],
  templateUrl: './facility-card.html',
  styleUrl: './facility-card.css',
})
export class FacilityCard {
  protected readonly language = inject(LanguageService);

  readonly facility = input.required<Facility>();
}
