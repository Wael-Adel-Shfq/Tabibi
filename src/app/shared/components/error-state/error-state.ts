import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-error-state',
  imports: [TranslatePipe],
  templateUrl: './error-state.html',
  styleUrl: './error-state.css',
})
export class ErrorState {
  readonly message = input('common.loadError');
  readonly retry = output<void>();
}
