import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { FormFieldWrapper } from '../../../shared/components/form-field/form-field';

@Component({
  selector: 'app-admin-login',
  imports: [FormField, RouterLink, MatButtonModule, TranslatePipe, FormFieldWrapper],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class AdminLogin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly model = signal({ email: '', password: '' });
  protected readonly credentials = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
  });
  /** Translation key of the last failure, if any. */
  protected readonly failure = signal<string | null>(null);

  constructor() {
    // Already signed in as an admin: go straight to the dashboard.
    void this.auth.ready().then(() => {
      if (this.auth.isAdmin()) void this.router.navigateByUrl('/admin');
    });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.failure.set(null);
    await submit(this.credentials, async () => {
      try {
        const { email: address, password } = this.model();
        const isAdmin = await this.auth.signIn(address.trim(), password);
        if (isAdmin) await this.router.navigateByUrl('/admin');
        else this.failure.set('admin.login.notAdmin');
      } catch {
        this.failure.set('admin.login.failed');
      }
      return undefined;
    });
  }
}
