import { Component, effect, inject, input, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Doctor } from '../../../core/models/entities';
import { ContactActions } from '../../../shared/components/contact-actions/contact-actions';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../shared/components/loading-state/loading-state';
import { PublicHeader } from '../../../shared/components/public-header/public-header';
import { DoctorsService } from '../doctors.service';

@Component({
  selector: 'app-doctor-detail',
  imports: [
    IonContent,
    TranslatePipe,
    PublicHeader,
    ContactActions,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './doctor-detail.html',
  styleUrl: './doctor-detail.css',
})
export class DoctorDetail {
  private readonly doctors = inject(DoctorsService);
  protected readonly language = inject(LanguageService);

  /** Route parameter. */
  readonly id = input.required<string>();

  protected readonly doctor = signal<Doctor | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      void this.load(id);
    });
  }

  protected async load(id: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.doctor.set(await this.doctors.getById(id));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
