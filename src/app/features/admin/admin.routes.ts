import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/admin.guard';

/**
 * Admin area. The guard only improves navigation; the database refuses every
 * privileged read or write from a non-admin session regardless.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.AdminLogin),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./shell/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'submissions',
        loadComponent: () =>
          import('./submissions/submissions-admin/submissions-admin').then((m) => m.SubmissionsAdmin),
      },
      {
        path: 'doctors',
        loadComponent: () =>
          import('./doctors/doctors-admin/doctors-admin').then((m) => m.DoctorsAdmin),
      },
      {
        path: 'facilities',
        loadComponent: () =>
          import('./facilities/facilities-admin/facilities-admin').then((m) => m.FacilitiesAdmin),
      },
      {
        path: 'advertisements',
        loadComponent: () => import('./advertisements/ads-admin/ads-admin').then((m) => m.AdsAdmin),
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./locations/locations-admin/locations-admin').then((m) => m.LocationsAdmin),
      },
      {
        path: 'tips',
        loadComponent: () => import('./health-tips/tips-admin/tips-admin').then((m) => m.TipsAdmin),
      },
      {
        path: 'specialties',
        data: { table: 'specialties' },
        loadComponent: () => import('./lookups/lookup-list/lookup-list').then((m) => m.LookupList),
      },
    ],
  },
];
