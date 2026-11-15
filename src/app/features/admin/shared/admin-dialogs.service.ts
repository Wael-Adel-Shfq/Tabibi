import { ComponentType } from '@angular/cdk/portal';
import { inject, Service } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog/confirm-dialog';

/** Opens admin dialogs with consistent size, direction and focus handling. */
@Service()
export class AdminDialogs {
  private readonly dialog = inject(MatDialog);
  private readonly language = inject(LanguageService);

  /** Opens a form dialog and resolves with its result (undefined when dismissed). */
  open<TData, TResult>(
    component: ComponentType<unknown>,
    data: TData,
    width = '640px',
  ): Promise<TResult | undefined> {
    const ref = this.dialog.open<unknown, TData, TResult>(component, {
      data,
      width,
      maxWidth: '96vw',
      maxHeight: '92vh',
      direction: this.language.dir(),
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    return firstValueFrom(ref.afterClosed());
  }

  /** Asks the admin to confirm a destructive or notable action. */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    return (await this.open<ConfirmDialogData, boolean>(ConfirmDialog, data, '420px')) === true;
  }
}
