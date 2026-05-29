import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/applications/list.component').then((m) => m.ListComponent),
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./pages/applications/create.component').then((m) => m.CreateComponent),
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./pages/applications/detail.component').then((m) => m.DetailComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
