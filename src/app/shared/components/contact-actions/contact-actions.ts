import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { callOutline, locationOutline } from 'ionicons/icons';
import type { Located } from '../../../core/models/entities';
import { mapHref, telHref } from '../../utils/links';

/** "Call" and "Open map" links for a doctor, facility or advertisement. */
@Component({
  selector: 'app-contact-actions',
  imports: [IonIcon, TranslatePipe],
  templateUrl: './contact-actions.html',
  styleUrl: './contact-actions.css',
  host: { '[class.compact]': 'compact()' },
})
export class ContactActions {
  readonly phone = input<string | null>(null);
  readonly place = input.required<Located>();
  /** Name of the record, used to give each link a distinct accessible name. */
  readonly name = input.required<string>();
  /** Round icon-only buttons, for small cards; the accessible name stays the same. */
  readonly compact = input(false);

  protected readonly tel = computed(() => telHref(this.phone()));
  protected readonly map = computed(() => mapHref(this.place()));


  // whatsappUrl = computed(() => {
  //   const number = (this.phone() ?? '').replace(/\D/g, '');
  //   const countryCode = 2; // Replace with the actual country code

  //   return number
  //     ? `https://wa.me/${countryCode}/${number}`
  //     : '';
  // });


  whatsappUrl = computed(() => {
    let number = (this.phone() ?? '').replace(/\D/g, '');

    const countryCode = '20';

    if (!number) return '';

    // Remove international dialing prefix
    if (number.startsWith('00')) {
      number = number.slice(2);
    }

    // Already has Egypt country code
    if (number.startsWith(countryCode)) {
      return `https://wa.me/${number}`;
    }

    // Remove local leading zero
    if (number.startsWith('0')) {
      number = number.slice(1);
    }

    return `https://wa.me/${countryCode}${number}`;
  });

  constructor() {
    addIcons({ callOutline, locationOutline });
  }
}
