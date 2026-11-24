import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  businessOutline,
  earthOutline,
  flaskOutline,
  homeOutline,
  languageOutline,
  logoWhatsapp,
  medicalOutline,
  medkitOutline,
} from 'ionicons/icons';
import { LanguageService } from '../../core/i18n/language.service';
import type { FacilityType } from '../../core/models/entities';
import { DirectoryFilterStore } from '../locations/location-filter.store';

interface FacilityLink {
  type: FacilityType;
  label: string;
  icon: string;
}

/**
 * Layout of the public application: bottom tabs for the main pages, plus a
 * side menu (opened from the header of each tab page) listing every section,
 * including each facility type and the language switch.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonMenu,
    IonMenuToggle,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    TranslatePipe
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly router = inject(Router);
  private readonly filter = inject(DirectoryFilterStore);
  protected readonly language = inject(LanguageService);

  protected readonly facilityLinks: readonly FacilityLink[] = [
    { type: 'lab', label: 'categories.lab', icon: 'flask-outline' },
    { type: 'pharmacy', label: 'categories.pharmacy', icon: 'medical-outline' },
    { type: 'medical_center', label: 'categories.medical_center', icon: 'business-outline' },
  ];
whatsapp: any;

  constructor() {
    addIcons({
      homeOutline,
      medkitOutline,
      businessOutline,
      addCircleOutline,
      flaskOutline,
      medicalOutline,
      languageOutline,
      earthOutline,
      logoWhatsapp
    });
  }

  /** Opens the facilities tab on one facility type. */
  protected openFacilities(type: FacilityType): void {
    this.filter.facilityType.set(type);
    void this.router.navigateByUrl('/facilities');
  }
}
