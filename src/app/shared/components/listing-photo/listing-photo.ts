import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { businessOutline, personOutline } from 'ionicons/icons';

/** Square photo of a doctor or facility, or a neutral icon when there is none. */
@Component({
  selector: 'app-listing-photo',
  imports: [IonIcon],
  templateUrl: './listing-photo.html',
  styleUrl: './listing-photo.css',
  host: { '[class.large]': "size() === 'large'", '[class.fill]': "size() === 'fill'" },
})
export class ListingPhoto {
  readonly src = input<string | null>(null);
  /** Alt text; next to the name the photo is decorative, so this is usually ''. */
  readonly alt = input('');
  readonly kind = input<'doctor' | 'facility'>('doctor');
  /** small: 4rem square; large: 7.5rem square; fill: as wide as its container. */
  readonly size = input<'small' | 'large' | 'fill'>('small');

  constructor() {
    addIcons({ personOutline, businessOutline });
  }
}
