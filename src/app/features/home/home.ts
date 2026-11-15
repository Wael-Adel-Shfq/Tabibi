import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  flaskOutline,
  medicalOutline,
  medkitOutline,
  searchOutline,
} from 'ionicons/icons';
import type { Doctor, FacilityType } from '../../core/models/entities';
import { AdSlot } from '../../shared/components/ad-slot/ad-slot';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../shared/components/error-state/error-state';
import { LoadingState } from '../../shared/components/loading-state/loading-state';
import { LocationFilter } from '../../shared/components/location-filter/location-filter';
import { PublicHeader } from '../../shared/components/public-header/public-header';
import { DoctorCard } from '../doctors/doctor-card/doctor-card';
import { DoctorsService } from '../doctors/doctors.service';
import { DirectoryFilterStore } from '../locations/location-filter.store';

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
    TranslatePipe,
    PublicHeader,
    LocationFilter,
    AdSlot,
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

  protected readonly categories: readonly Category[] = [
    { label: 'categories.doctors', icon: 'medkit-outline', facilityType: null },
    { label: 'categories.lab', icon: 'flask-outline', facilityType: 'lab' },
    { label: 'categories.pharmacy', icon: 'medical-outline', facilityType: 'pharmacy' },
    { label: 'categories.medical_center', icon: 'business-outline', facilityType: 'medical_center' },
  ];

  protected readonly term = signal('');
  protected readonly recent = signal<Doctor[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  constructor() {
    addIcons({ medkitOutline, flaskOutline, medicalOutline, businessOutline, searchOutline });
    void this.loadRecent();
  }

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  /** Opens the doctors list filtered by the typed name or specialty. */
  protected search(event: Event): void {
    event.preventDefault();
    this.filter.doctorTerm.set(this.term().trim());
    this.filter.specialtyId.set('');
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
