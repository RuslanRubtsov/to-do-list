import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSession, User, UsersService } from '@api';
import { firstValueFrom } from 'rxjs';
import { APP_INFO, APP_INFO_REQUEST } from '../../testing/app-info';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { Router } from '@angular/router';
import { failAsUnauthenticated, LOGGED_IN, LOGOUT, SESSION_REFRESH } from '../../testing/session';
import { holdBrowserLock } from '../../testing/web-locks';
import { SESSION_REFRESH_LOCK } from './session';

const CURRENT_USER_REQUEST = { method: 'GET', url: '/api/v1/users/me' };

/** The session after the backend rotated it: same User, new access token. */
const REFRESHED: AuthSession = { ...LOGGED_IN, accessToken: 'refreshed-access-token' };

interface RequestMatch {
  method: string;
  url: string;
}

function bearerOf(request: TestRequest): string | null {
  return request.request.headers.get('Authorization');
}

/** Answers as the backend does once the access token has expired. */
function failAsExpired(request: TestRequest): void {
  failAsUnauthenticated(request);
}

/**
 * The start page, logged in, with its request still waiting for an answer. The access token it
 * was sent with is about to be reported expired.
 */
async function renderWithPendingRequest(url = '/') {
  emulateMedia(DESKTOP);
  const page = await renderRoute(url);
  const http = page.http;
  const appInfo = http.expectOne(APP_INFO_REQUEST);
  expect(bearerOf(appInfo)).toBe(`Bearer ${LOGGED_IN.accessToken}`);
  return {
    page,
    appInfo,
    /**
     * The request, once the app has sent it. Refreshes wait their turn for a lock shared with
     * other tabs, so they and the replays after them go out a moment after what caused them.
     */
    awaitRequest: (match: RequestMatch) => vi.waitFor(() => http.expectOne(match)),
    /** Asserts nothing matching was sent, after giving the app the same moment to send it. */
    async expectNoRequest(match: RequestMatch) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      http.expectNone(match);
    },
  };
}

/** A second request in flight alongside the page's own, made through the generated API client. */
function requestCurrentUser(): Promise<User> {
  return firstValueFrom(TestBed.inject(UsersService).getCurrentUser());
}

describe('Expired access token', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is refreshed transparently and the request replayed with the new one', async () => {
    const { page, appInfo, awaitRequest } = await renderWithPendingRequest();

    failAsExpired(appInfo);
    (await awaitRequest(SESSION_REFRESH)).flush(REFRESHED);
    const replayed = await awaitRequest(APP_INFO_REQUEST);
    expect(bearerOf(replayed)).toBe(`Bearer ${REFRESHED.accessToken}`);
    replayed.flush(APP_INFO);

    expect(await page.text()).toContain('1.4.2');
    expect(await page.url()).toBe('/');
  });

  it('is refreshed once for every request it failed, all of which are replayed', async () => {
    const { page, appInfo, awaitRequest } = await renderWithPendingRequest();
    const currentUser = requestCurrentUser();
    const userRequest = page.http.expectOne(CURRENT_USER_REQUEST);

    failAsExpired(appInfo);
    failAsExpired(userRequest);
    (await awaitRequest(SESSION_REFRESH)).flush(REFRESHED);

    const replays = [
      await awaitRequest(APP_INFO_REQUEST),
      await awaitRequest(CURRENT_USER_REQUEST),
    ];
    expect(replays.map(bearerOf)).toEqual([
      `Bearer ${REFRESHED.accessToken}`,
      `Bearer ${REFRESHED.accessToken}`,
    ]);
    replays[0].flush(APP_INFO);
    replays[1].flush(LOGGED_IN.user);
    await expect(currentUser).resolves.toEqual(LOGGED_IN.user);
    expect(await page.text()).toContain('1.4.2');
  });

  it('is not refreshed again for a request that failed after the refresh already happened', async () => {
    const { page, appInfo, awaitRequest, expectNoRequest } = await renderWithPendingRequest();
    const currentUser = requestCurrentUser();
    const userRequest = page.http.expectOne(CURRENT_USER_REQUEST);
    failAsExpired(appInfo);
    (await awaitRequest(SESSION_REFRESH)).flush(REFRESHED);
    (await awaitRequest(APP_INFO_REQUEST)).flush(APP_INFO);

    // Sent with the old token before the refresh, answered after it
    failAsExpired(userRequest);

    const replayed = await awaitRequest(CURRENT_USER_REQUEST);
    expect(bearerOf(replayed)).toBe(`Bearer ${REFRESHED.accessToken}`);
    replayed.flush(LOGGED_IN.user);
    await expect(currentUser).resolves.toEqual(LOGGED_IN.user);
    await expectNoRequest(SESSION_REFRESH);
  });

  it('sends the User to log in, to come back afterwards, when the session has ended', async () => {
    const { page, appInfo, awaitRequest } = await renderWithPendingRequest('/?view=bookmarked');

    failAsExpired(appInfo);
    failAsUnauthenticated(await awaitRequest(SESSION_REFRESH));

    await vi.waitFor(async () =>
      expect(await page.url()).toBe('/login?returnUrl=%2F%3Fview%3Dbookmarked'),
    );
    // Logged out here too: the login page stays put instead of sending the User back
    expect(page.has('Log in')).toBe(true);
  });

  it('waits while another tab refreshes the shared session, then refreshes after it', async () => {
    // Every tab sends the same refresh token cookie: refreshing alongside another tab would
    // present the token that tab is rotating, which the backend treats as theft
    const { page, appInfo, awaitRequest, expectNoRequest } = await renderWithPendingRequest();
    const otherTab = holdBrowserLock(SESSION_REFRESH_LOCK);

    failAsExpired(appInfo);
    await expectNoRequest(SESSION_REFRESH);

    otherTab.release();
    (await awaitRequest(SESSION_REFRESH)).flush(REFRESHED);
    (await awaitRequest(APP_INFO_REQUEST)).flush(APP_INFO);

    expect(await page.text()).toContain('1.4.2');
  });

  it('keeps the User logged in when the server could not be reached to refresh it', async () => {
    const { page, appInfo, awaitRequest } = await renderWithPendingRequest();

    failAsExpired(appInfo);
    (await awaitRequest(SESSION_REFRESH)).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.text()).toContain("Can't reach the server");
    expect(await page.url()).toBe('/');
    expect(await page.text()).toContain(LOGGED_IN.user.displayName);
  });

  it('does not bring back a session the User logged out of while it was being refreshed', async () => {
    const { page, appInfo, awaitRequest } = await renderWithPendingRequest();
    failAsExpired(appInfo);
    const refresh = await awaitRequest(SESSION_REFRESH);

    page.click('Log out');
    page.http.expectOne(LOGOUT).flush(null, { status: 204, statusText: 'No Content' });
    refresh.flush(REFRESHED);
    await vi.waitFor(async () => expect(await page.url()).toMatch(/^\/login/));

    await TestBed.inject(Router).navigateByUrl('/');
    expect(await page.url()).toBe('/login?returnUrl=%2F');
  });

  it('is not refreshed over and over when the replayed request is refused too', async () => {
    const { page, appInfo, awaitRequest, expectNoRequest } = await renderWithPendingRequest();

    failAsExpired(appInfo);
    (await awaitRequest(SESSION_REFRESH)).flush(REFRESHED);
    failAsExpired(await awaitRequest(APP_INFO_REQUEST));

    await expectNoRequest(SESSION_REFRESH);
    expect(await page.text()).toContain('The server ran into a problem');
  });
});
