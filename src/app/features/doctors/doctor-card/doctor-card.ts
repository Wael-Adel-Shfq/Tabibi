import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Doctor } from '../../../core/models/entities';
import { ContactActions } from '../../../shared/components/contact-actions/contact-actions';

@Component({
  selector: 'app-doctor-card',
  imports: [RouterLink, TranslatePipe, ContactActions],
  templateUrl: './doctor-card.html',
  styleUrl: './doctor-card.css',
})
export class DoctorCard {
  protected readonly language = inject(LanguageService);

  readonly doctor = input.required<Doctor>();
}
