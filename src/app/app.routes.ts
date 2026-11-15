import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'doctors',
        loadComponent: () =>
          import('./features/doctors/doctors-list/doctors-list').then((m) => m.DoctorsList),
      },
      {
        path: 'doctors/:id',
        loadComponent: () =>
          import('./features/doctors/doctor-detail/doctor-detail').then((m) => m.DoctorDetail),
      },
      {
        path: 'facilities',
        loadComponent: () =>
          import('./features/facilities/facilities-list/facilities-list').then(
            (m) => m.FacilitiesList,
          ),
      },
      {
        path: 'suggest',
        loadComponent: () =>
          import('./features/doctor-submissions/submission-form/submission-form').then(
            (m) => m.SubmissionForm,
          ),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
