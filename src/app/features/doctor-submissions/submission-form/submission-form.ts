import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { IonContent } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Area } from '../../../core/models/entities';
import { orNull } from '../../../core/supabase/unwrap';
import { FormFieldWrapper } from '../../../shared/components/form-field/form-field';
import { PublicHeader } from '../../../shared/components/public-header/public-header';
import { PHONE_PATTERN, URL_PATTERN } from '../../../shared/utils/validation';
import { LocationsService } from '../../locations/locations.service';
import { SubmissionsService, SubmitOutcome } from '../submissions.service';

/** Sentinel option for a specialty that is not in the list. */
const OTHER = 'other';

interface SuggestionModel {
  full_name: string;
  specialty_id: string;
  specialty_other: string;
  clinic_phone: string;
  governorate_id: string;
  area_id: string;
  address: string;
  map_url: string;
  submitter_name: string;
  submitter_contact: string;
  /** Honeypot. Hidden from people; bots tend to fill it. */
  website: string;
}

function emptyModel(): SuggestionModel {
  return {
    full_name: '',
    specialty_id: '',
    specialty_other: '',
    clinic_phone: '',
    governorate_id: '',
    area_id: '',
    address: '',
    map_url: '',
    submitter_name: '',
    submitter_contact: '',
    website: '',
  };
}

/** Public "suggest a doctor" form. Stored as pending until an admin reviews it. */
@Component({
  selector: 'app-submission-form',
  imports: [IonContent, FormField, TranslatePipe, PublicHeader, FormFieldWrapper],
  templateUrl: './submission-form.html',
  styleUrl: './submission-form.css',
})
export class SubmissionForm {
  private readonly submissions = inject(SubmissionsService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly other = OTHER;
  protected readonly model = signal<SuggestionModel>(emptyModel());
  protected readonly areas = signal<Area[]>([]);
  /** Result of the last attempt; `null` while the form is being filled. */
  protected readonly outcome = signal<SubmitOutcome | null>(null);

  protected readonly suggestion = form(this.model, (path) => {
    required(path.full_name);
    minLength(path.full_name, 2);
    maxLength(path.full_name, 150);
    required(path.specialty_id);
    required(path.specialty_other, {
      when: ({ valueOf }) => valueOf(path.specialty_id) === OTHER,
    });
    maxLength(path.specialty_other, 80);
    pattern(path.clinic_phone, PHONE_PATTERN);
    required(path.governorate_id);
    required(path.area_id);
    required(path.address);
    minLength(path.address, 3);
    maxLength(path.address, 300);
    pattern(path.map_url, URL_PATTERN);
    maxLength(path.submitter_name, 100);
    maxLength(path.submitter_contact, 150);
  });

  constructor() {
    void this.locations.load().catch(() => undefined);
  }

  /** The area list follows the governorate, and a stale area is cleared. */
  protected async onGovernorateChange(): Promise<void> {
    this.model.update((value) => ({ ...value, area_id: '' }));
    this.areas.set([]);
    const governorateId = this.model().governorate_id;
    try {
      const areas = await this.locations.areasOf(governorateId);
      if (this.model().governorate_id === governorateId) this.areas.set(areas);
    } catch {
      this.areas.set([]);
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.outcome.set(null);
    await submit(this.suggestion, async () => {
      const value = this.model();
      const listed = value.specialty_id !== OTHER;
      const outcome = await this.submissions.submit({
        full_name: value.full_name.trim(),
        specialty_id: listed ? value.specialty_id : null,
        specialty_other: listed ? null : orNull(value.specialty_other),
        clinic_phone: orNull(value.clinic_phone),
        governorate_id: value.governorate_id,
        area_id: value.area_id,
        address: value.address.trim(),
        map_url: orNull(value.map_url),
        submitter_name: orNull(value.submitter_name),
        submitter_contact: orNull(value.submitter_contact),
        website: value.website,
      });
      this.outcome.set(outcome);
      return undefined;
    });
  }

  protected startOver(): void {
    this.suggestion().reset(emptyModel());
    this.areas.set([]);
    this.outcome.set(null);
  }
}
