import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatedPaginatorIntl } from '../shared/paginator-intl';

interface NavItem {
  path: string;
  label: string;
  exact: boolean;
}

/** Layout of the admin area: header, section navigation and the routed page. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, TranslatePipe],
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly nav: readonly NavItem[] = [
    { path: '/admin', label: 'admin.nav.dashboard', exact: true },
    { path: '/admin/submissions', label: 'admin.nav.submissions', exact: false },
    { path: '/admin/doctors', label: 'admin.nav.doctors', exact: false },
    { path: '/admin/facilities', label: 'admin.nav.facilities', exact: false },
    { path: '/admin/advertisements', label: 'admin.nav.advertisements', exact: false },
    { path: '/admin/locations', label: 'admin.nav.locations', exact: false },
    { path: '/admin/specialties', label: 'admin.nav.specialties', exact: false },
  ];

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/admin/login');
  }
}
