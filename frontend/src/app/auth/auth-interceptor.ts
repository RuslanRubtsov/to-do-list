import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { isUnauthorized } from '../http/problems';
import { Session } from './session';

/**
 * Sends the access token with every request to our own API, and to nowhere else. When the backend
 * says the token has expired, gets a new one and replays the request with it, so the User never
 * notices. When the session itself has ended, sends the User to log in, to come back afterwards.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const session = inject(Session);
  const router = inject(Router);
  const sentToken = session.accessToken();

  return next(withToken(request, sentToken)).pipe(
    catchError((error: unknown) => {
      if (!sentToken || !isExpiredToken(error, request)) return throwError(() => error);
      // If the backend can't be asked for a new token, the request fails with that reason instead
      // and the session stays
      return renewedToken(session, sentToken).pipe(
        switchMap((token) => {
          if (token) return next(withToken(request, token));
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => error);
        }),
      );
    }),
  );
};

function withToken<T>(request: HttpRequest<T>, accessToken: string | null): HttpRequest<T> {
  return accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;
}

/** A 401 from anything but the auth endpoints, which answer 401 for reasons of their own. */
function isExpiredToken(error: unknown, request: HttpRequest<unknown>): boolean {
  return isUnauthorized(error) && !request.url.startsWith('/api/v1/auth/');
}

/**
 * The token to replay with. If another request already got a new one since this one was sent,
 * that one; otherwise a fresh refresh, shared with every other request waiting for it.
 */
function renewedToken(session: Session, sentToken: string): Observable<string | null> {
  const current = session.accessToken();
  return current && current !== sentToken ? of(current) : session.refreshAccessToken();
}
