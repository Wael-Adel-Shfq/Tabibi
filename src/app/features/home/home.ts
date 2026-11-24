import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  chevronForwardOutline,
  flaskOutline,
  medicalOutline,
  medkitOutline,
  megaphoneOutline,
} from 'ionicons/icons';
import { LanguageService } from '../../core/i18n/language.service';
import type { Doctor, FacilityType, HealthTip } from '../../core/models/entities';
import { AdSlot } from '../../shared/components/ad-slot/ad-slot';
import { AdPopup } from '../../shared/components/ad-popup/ad-popup';
import { DirectorySearch } from '../../shared/components/directory-search/directory-search';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { LoadingState } from '../../shared/components/loading-state/loading-state';
import { PublicHeader } from '../../shared/components/public-header/public-header';
import { DoctorCard } from '../doctors/doctor-card/doctor-card';
import { DoctorsService } from '../doctors/doctors.service';
import { HealthTipsService } from '../health-tips/health-tips.service';
import { DirectoryFilterStore } from '../locations/location-filter.store';
import { LocationsService } from '../locations/locations.service';

interface Category {
  label: string;
  icon: string;
  facilityType: FacilityType | null;
}

@Component({
  selector: 'app-home',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    TranslatePipe,
    PublicHeader,
    DirectorySearch,
    AdSlot,
    AdPopup,
    DoctorCard,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly router = inject(Router);
  private readonly doctors = inject(DoctorsService);
  private readonly filter = inject(DirectoryFilterStore);
  private readonly tips = inject(HealthTipsService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly categories: readonly Category[] = [
    { label: 'categories.doctors', icon: 'medkit-outline', facilityType: null },
    { label: 'categories.lab', icon: 'flask-outline', facilityType: 'lab' },
    { label: 'categories.pharmacy', icon: 'medical-outline', facilityType: 'pharmacy' },
    { label: 'categories.medical_center', icon: 'business-outline', facilityType: 'medical_center' },
  ];

  /** Today's "كل يوم معلومة" entry, managed in Admin → Daily tips. */
  private readonly tip = signal<HealthTip | null>(null);
  /** The tip in the page language; the English site falls back to the Arabic text. */
  protected readonly tipText = computed(() => {
    const tip = this.tip();
    if (!tip) return null;
    return this.language.lang() === 'en' && tip.text_en
      ? { text: tip.text_en, lang: 'en' }
      : { text: tip.text_ar, lang: 'ar' };
  });

  protected readonly term = signal('');
  protected readonly recent = signal<Doctor[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  constructor() {
    addIcons({
      medkitOutline,
      flaskOutline,
      medicalOutline,
      businessOutline,
      chevronForwardOutline,
      megaphoneOutline,
    });
    void this.locations.load().catch(() => undefined);
    void this.loadRecent();
    // The card is optional: if tips fail to load, the page simply goes without it.
    this.tips.today().then((tip) => this.tip.set(tip), () => undefined);
  }

  /** Opens the doctors list with the typed text and the filters chosen in the sheet. */
  protected search(): void {
    this.filter.doctorTerm.set(this.term().trim());
    void this.router.navigateByUrl('/doctors');
  }

  protected openSpecialty(id: string): void {
    this.filter.specialtyId.set(id);
    void this.router.navigateByUrl('/doctors');
  }

  protected open(category: Category): void {
    if (category.facilityType) {
      this.filter.facilityType.set(category.facilityType);
      void this.router.navigateByUrl('/facilities');
    } else {
      void this.router.navigateByUrl('/doctors');
    }
  }

  protected async loadRecent(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.recent.set(await this.doctors.recent());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
