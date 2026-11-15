import { Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Facility } from '../../../core/models/entities';
import { ContactActions } from '../../../shared/components/contact-actions/contact-actions';
import { ListingPhoto } from '../../../shared/components/listing-photo/listing-photo';
import { FacilitiesService } from '../facilities.service';

@Component({
  selector: 'app-facility-card',
  imports: [TranslatePipe, ContactActions, ListingPhoto],
  templateUrl: './facility-card.html',
  styleUrl: './facility-card.css',
})
export class FacilityCard {
  protected readonly language = inject(LanguageService);

  private readonly service = inject(FacilitiesService);

  readonly facility = input.required<Facility>();

  protected readonly photo = computed(() => this.service.imageUrl(this.facility().image_path));
}
