import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { DoctorSubmission, PAGE_SIZE, SubmissionStatus } from '../../../../core/models/entities';
import { ToastService } from '../../../../core/ui/toast.service';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { LoadingState } from '../../../../shared/components/loading-state/loading-state';
import { PagedList } from '../../../../shared/utils/paged-list';
import { SubmissionsService } from '../../../doctor-submissions/submissions.service';
import { AdminDialogs } from '../../shared/admin-dialogs.service';
import { adminErrorKey } from '../../shared/admin-errors';
import { ReviewDialog, ReviewDialogData, ReviewResult } from '../review-dialog/review-dialog';

type StatusFilter = SubmissionStatus | 'all';

@Component({
  selector: 'app-submissions-admin',
  imports: [
    DatePipe,
    MatButtonModule,
    MatPaginatorModule,
    TranslatePipe,
    LoadingState,
    ErrorState,
    EmptyState,
  ],
  templateUrl: './submissions-admin.html',
  styleUrl: './submissions-admin.css',
})
export class SubmissionsAdmin {
  private readonly submissions = inject(SubmissionsService);
  private readonly dialogs = inject(AdminDialogs);
  private readonly toast = inject(ToastService);
  protected readonly language = inject(LanguageService);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly statuses: readonly StatusFilter[] = ['pending', 'approved', 'rejected', 'all'];
  protected readonly status = signal<StatusFilter>('pending');

  protected readonly list = new PagedList<DoctorSubmission>((page) =>
    this.submissions.list(this.status(), page),
  );

  constructor() {
    effect(() => {
      this.status();
      untracked(() => void this.list.reload());
    });
  }

  protected setStatus(status: StatusFilter): void {
    this.status.set(status);
  }

  protected onPage(event: PageEvent): void {
    void this.list.goTo(event.pageIndex);
  }

  protected async review(submission: DoctorSubmission): Promise<void> {
    const result = await this.dialogs.open<ReviewDialogData, ReviewResult>(
      ReviewDialog,
      { submission },
      '720px',
    );
    if (!result) return;
    await this.toast.success(result === 'approved' ? 'admin.review.approvedToast' : 'admin.review.rejectedToast');
    await this.list.refresh();
  }

  protected async remove(submission: DoctorSubmission): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'admin.review.deleteTitle',
      subject: submission.full_name,
      message: 'admin.deleteWarning',
      confirm: 'common.delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await this.submissions.remove(submission.id);
      await this.toast.success('common.deleted');
    } catch (error) {
      await this.toast.error(adminErrorKey(error));
    }
    await this.list.refresh();
  }
}
