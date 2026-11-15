import { inject, Service } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

/** Short confirmation and error messages. Takes translation keys. */
@Service()
export class ToastService {
  private readonly toasts = inject(ToastController);
  private readonly translate = inject(TranslateService);

  success(key: string): Promise<void> {
    return this.show(key, 'success');
  }

  error(key = 'common.error'): Promise<void> {
    return this.show(key, 'danger');
  }

  private async show(key: string, kind: 'success' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({
      message: String(this.translate.instant(key)),
      duration: kind === 'danger' ? 5000 : 2500,
      position: 'top',
      color: kind === 'danger' ? 'danger' : 'primary',
      buttons: [{ text: String(this.translate.instant('common.close')), role: 'cancel' }],
    });
    await toast.present();
  }
}
