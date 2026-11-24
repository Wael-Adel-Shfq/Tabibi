import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../core/i18n/language.service';
import { type Doctor, withoutRegions } from '../../../core/models/entities';
import { ContactActions } from '../../../shared/components/contact-actions/contact-actions';
import { ListingPhoto } from '../../../shared/components/listing-photo/listing-photo';
import { DoctorsService } from '../doctors.service';

@Component({
  selector: 'app-doctor-card',
  imports: [RouterLink, ContactActions, ListingPhoto],
  templateUrl: './doctor-card.html',
  styleUrl: './doctor-card.css',
})
export class DoctorCard {
  protected readonly language = inject(LanguageService);

  private readonly service = inject(DoctorsService);

  readonly doctor = input.required<Doctor>();

  protected readonly place = computed(() => withoutRegions(this.doctor().location_chain));
  protected readonly photo = computed(() => this.service.imageUrl(this.doctor().image_path));
}
