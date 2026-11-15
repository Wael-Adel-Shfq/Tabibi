import { Component, input } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-loading-state',
  imports: [IonSpinner, TranslatePipe],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.css',
})
export class LoadingState {
  readonly label = input('common.loading');
}
