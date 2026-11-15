import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** UI convenience only: the database enforces admin access through RLS. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();
  return auth.isAdmin() ? true : router.createUrlTree(['/admin/login']);
};
