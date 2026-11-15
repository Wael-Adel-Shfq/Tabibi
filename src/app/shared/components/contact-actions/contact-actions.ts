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
})
export class ContactActions {
  readonly phone = input<string | null>(null);
  readonly place = input.required<Located>();
  /** Name of the record, used to give each link a distinct accessible name. */
  readonly name = input.required<string>();

  protected readonly tel = computed(() => telHref(this.phone()));
  protected readonly map = computed(() => mapHref(this.place()));

  constructor() {
    addIcons({ callOutline, locationOutline });
  }
}
