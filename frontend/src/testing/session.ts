import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { AuthSession, AuthSessionTokenTypeEnum, Language } from '@api';

export const SESSION_REFRESH = { method: 'POST', url: '/api/v1/auth/session/refresh' };
export const LOGIN = { method: 'POST', url: '/api/v1/auth/login' };
export const REGISTER = { method: 'POST', url: '/api/v1/auth/register' };
export const LOGOUT = { method: 'POST', url: '/api/v1/auth/session/logout' };

/** The User the app is logged in as unless a test says otherwise. */
export const LOGGED_IN: AuthSession = {
  accessToken: 'access-token-of-olena',
  tokenType: AuthSessionTokenTypeEnum.Bearer,
  expiresIn: 900,
  user: { id: 7, email: 'olena@example.com', displayName: 'Olena', preferredLanguage: Language.en },
};

/** Answers a request the way the backend answers one without a valid session. */
export function failAsUnauthenticated(request: TestRequest): void {
  request.flush(
    { status: 401, title: 'Unauthorized', code: 'UNAUTHENTICATED' },
    { status: 401, statusText: 'Unauthorized' },
  );
}

/**
 * Waits for the app to try restoring the session from the refresh token cookie, as it does once
 * per page load, and answers with `session`, or as for a visitor without one when it is `null`.
 */
export async function answerSessionRefresh(
  http: HttpTestingController,
  session: AuthSession | null,
): Promise<void> {
  const request = await vi.waitFor(() => http.expectOne(SESSION_REFRESH), LAZY_ROUTE_WAIT);
  if (session) {
    request.flush(session);
  } else {
    failAsUnauthenticated(request);
  }
}

/**
 * How long to wait for a request a routed page makes once it loads. Pages are lazy-loaded chunks,
 * which can take well over `vi.waitFor`'s default second under a loaded test run with coverage.
 */
export const LAZY_ROUTE_WAIT = { timeout: 4000, interval: 10 };
