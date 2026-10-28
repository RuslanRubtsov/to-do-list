import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Languages } from '../i18n/languages';
import { Session } from './session';

/**
 * Lets in logged-in Users; sends visitors to log in, remembering where they were going. A User
 * who prefers another language than this build's, perhaps chosen on another device, gets the
 * page from that language's build instead: whether they just logged in or their session was
 * restored on load.
 */
export const loggedInGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session);
  const router = inject(Router);
  const languages = inject(Languages);
  await session.restore();
  const user = session.user();
  if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (user.preferredLanguage !== languages.current) {
    languages.open(user.preferredLanguage, state.url);
    return false;
  }
  return true;
};

/** Keeps logged-in Users off the login and registration pages. */
export const visitorGuard: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.restore();
  return session.user() ? router.parseUrl('/') : true;
};

/**
 * Where to go after logging in: the requested page, as long as it is one of ours. Anything else,
 * such as `//evil.example`, which browsers read as another site, falls back to the start page.
 */
export function returnUrlTree(router: Router, returnUrl: string | null | undefined): UrlTree {
  const ours = !!returnUrl && returnUrl.startsWith('/') && !/^\/[/\\]/.test(returnUrl);
  return router.parseUrl(ours ? returnUrl : '/');
}
