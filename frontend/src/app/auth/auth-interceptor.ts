import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Session } from './session';

/** Sends the access token with every request to our own API, and to nowhere else. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const accessToken = inject(Session).accessToken();
  if (!accessToken || !request.url.startsWith('/api/')) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
};
