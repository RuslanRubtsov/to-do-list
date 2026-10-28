import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Language } from '@api';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LOGGED_IN } from '../../testing/session';

const APP_INFO = { name: 'todo-backend', version: '1.4.2', buildTime: '2026-10-22T09:00:00Z' };

describe('Session', () => {
  beforeEach(() => emulateMedia(DESKTOP));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is restored on page load from the refresh token cookie, without logging in again', async () => {
    // renderRoute answers the refresh request the page load makes with a session
    const page = await renderRoute('/');
    page.http.expectOne('/api/v1/app-info').flush(APP_INFO);

    expect(await page.url()).toBe('/');
    expect(await page.text()).toContain(LOGGED_IN.user.displayName);
  });

  it("is restored in the build for the User's preferred language, at the same page", async () => {
    // Chosen on another device, say, since this one last loaded the app
    const prefersUkrainian = {
      ...LOGGED_IN,
      user: { ...LOGGED_IN.user, preferredLanguage: Language.uk },
    };

    const page = await renderRoute('/?view=bookmarked', { session: prefersUkrainian });

    expect(page.pageLoads()).toEqual(['/uk/?view=bookmarked']);
    // This build shows nothing meanwhile: no start page, so no request of its own
    page.http.expectNone('/api/v1/app-info');
  });

  it('stays in this build when the User prefers its language', async () => {
    const page = await renderRoute('/');
    page.http.expectOne('/api/v1/app-info').flush(APP_INFO);

    expect(page.pageLoads()).toEqual([]);
  });

  it('sends its access token with API requests', async () => {
    const page = await renderRoute('/');

    const appInfo = page.http.expectOne('/api/v1/app-info');
    expect(appInfo.request.headers.get('Authorization')).toBe(`Bearer ${LOGGED_IN.accessToken}`);
    appInfo.flush(APP_INFO);
  });

  it('is required by the app: visitors are sent to log in, to come back afterwards', async () => {
    const page = await renderRoute('/?view=bookmarked', { session: null });

    expect(await page.url()).toBe('/login?returnUrl=%2F%3Fview%3Dbookmarked');
    expect(page.has('Log in')).toBe(true);
  });
});
