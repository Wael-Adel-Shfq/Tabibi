import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import type { DoctorSubmission, DuplicateDoctor, Location } from '../../../../core/models/entities';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { LocationPicker } from '../../../../shared/components/location-picker/location-picker';
import { SearchSelect } from '../../../../shared/components/search-select/search-select';
import { LocationField } from '../../../../shared/utils/location-field';
import { LocationQuickAdd } from '../../shared/location-quick-add.service';
import { mapHref } from '../../../../shared/utils/links';
import { ApprovalProblem, SubmissionsService } from '../../../doctor-submissions/submissions.service';
import { LocationsService } from '../../../locations/locations.service';
import { adminErrorKey } from '../../shared/admin-errors';

export interface ReviewDialogData {
  submission: DoctorSubmission;
}

/** Result reported back to the list: what the reviewer did. */
export type ReviewResult = 'approved' | 'rejected';

/**
 * Shows one suggestion with any similar existing doctors, and lets the admin
 * approve (choosing a listed specialty when the visitor typed their own) or
 * reject it with a note.
 */
@Component({
  selector: 'app-review-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe, LoadingState, LocationPicker, SearchSelect],
  templateUrl: './review-dialog.html',
  styleUrl: './review-dialog.css',
})
export class ReviewDialog {
  protected readonly submission = inject<ReviewDialogData>(MAT_DIALOG_DATA).submission;
  private readonly ref = inject<MatDialogRef<ReviewDialog, ReviewResult>>(MatDialogRef);
  private readonly submissions = inject(SubmissionsService);
  protected readonly locations = inject(LocationsService);
  protected readonly language = inject(LanguageService);

  protected readonly pending = this.submission.status === 'pending';
  protected readonly map = mapHref(this.submission);

  protected readonly duplicates = signal<DuplicateDoctor[] | null>(null);
  protected readonly specialtyId = signal(this.submission.specialty_id ?? '');
  protected readonly allowDuplicate = signal(false);
  protected readonly note = signal('');
  protected readonly busy = signal(false);

  private readonly quickAdd = inject(LocationQuickAdd);
  /** Where the doctor will be placed; starts at the visitor's choice. */
  protected readonly location = new LocationField(this.submission);
  private readonly chosenLocationId = signal<string | null>(null);
  /** Translation key of the last problem, if any. */
  protected readonly failure = signal<string | null>(null);

  constructor() {
    void this.locations.load().catch(() => undefined);
    if (this.pending) void this.loadDuplicates();
  }

  private async loadDuplicates(): Promise<void> {
    try {
      this.duplicates.set(await this.submissions.duplicates(this.submission.id));
    } catch {
      this.duplicates.set([]);
      this.failure.set('admin.review.duplicatesFailed');
    }
  }

  protected onLocation(location: Location | null): void {
    this.location.select(location);
    this.chosenLocationId.set(location?.id ?? null);
  }

  /** Creates the missing place (pre-filled with the visitor's proposal) and selects it. */
  protected async onAddRequest(parent: Location): Promise<void> {
    const created = await this.quickAdd.create(parent, this.submission.location_other ?? undefined);
    if (!created) return;
    this.location.path.set([...created.path]);
    this.onLocation(created);
  }

  protected onAllowDuplicate(event: Event): void {
    this.allowDuplicate.set((event.target as HTMLInputElement).checked);
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected async approve(): Promise<void> {
    if (!this.specialtyId()) {
      this.failure.set('admin.review.specialty_required');
      return;
    }
    await this.run(async () => {
      const problem: ApprovalProblem | null = await this.submissions.approve(
        this.submission.id,
        this.specialtyId(),
        this.allowDuplicate(),
        this.chosenLocationId(),
      );
      if (problem) {
        this.failure.set('admin.review.' + problem);
        return;
      }
      this.ref.close('approved');
    });
  }

  protected async reject(): Promise<void> {
    await this.run(async () => {
      await this.submissions.reject(this.submission.id, this.note().trim() || null);
      this.ref.close('rejected');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await action();
    } catch (error) {
      this.failure.set(adminErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}
