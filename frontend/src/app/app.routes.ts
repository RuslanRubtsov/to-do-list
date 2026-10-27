import { Routes } from '@angular/router';
import { loggedInGuard, visitorGuard } from './auth/guards';

export const routes: Routes = [
  // The pages visitors use to get in stand on their own, outside the app shell
  {
    path: 'login',
    canActivate: [visitorGuard],
    loadComponent: () => import('./auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [visitorGuard],
    loadComponent: () => import('./auth/register-page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    canActivate: [loggedInGuard],
    children: [
      { path: '', loadComponent: () => import('./start/start-page').then((m) => m.StartPage) },
    ],
  },
];
