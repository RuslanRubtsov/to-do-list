import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerAppInfo } from '../../testing/app-info';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LOGGED_IN } from '../../testing/session';

const PROFILE_UPDATE = { method: 'PATCH', url: '/api/v1/users/me' };

async function renderProfile() {
  emulateMedia(DESKTOP);
  return renderRoute('/profile');
}

describe('Profile page', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('is reached from the navigation drawer', async () => {
    emulateMedia(DESKTOP);
    const page = await renderRoute('/');
    await answerAppInfo(page.http);

    page.click('Profile');

    expect(await page.url()).toBe('/profile');
  });

  it('shows the email the User logs in with', async () => {
    const page = await renderProfile();

    expect(await page.text()).toContain(LOGGED_IN.user.email);
  });

  it('renames the User, which the toolbar shows at once', async () => {
    const page = await renderProfile();

    await page.fill('Name', 'Olena K.');
    page.click('Save');
    const update = page.http.expectOne(PROFILE_UPDATE);
    expect(update.request.body).toEqual({ displayName: 'Olena K.' });
    update.flush({ ...LOGGED_IN.user, displayName: 'Olena K.' });

    const text = await page.text();
    expect(text).toContain('Your name is saved.');
    expect(page.toolbarText()).toContain('Olena K.');
  });

  it('asks for a name instead of saving a blank one', async () => {
    const page = await renderProfile();

    await page.fill('Name', '   ');
    page.click('Save');

    expect(await page.fieldErrors('Name')).toEqual(['Enter your name.']);
    page.http.expectNone(PROFILE_UPDATE);
  });

  it('shows the error the server gives for the name next to it', async () => {
    const page = await renderProfile();

    await page.fill('Name', 'Olena K.');
    page.click('Save');
    page.http.expectOne(PROFILE_UPDATE).flush(
      {
        status: 400,
        title: 'Bad Request',
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'displayName', code: 'SIZE' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await page.fieldErrors('Name')).toEqual(['Use at most 100 characters.']);
  });

  it('says so when the server is unreachable, keeping what was typed', async () => {
    const page = await renderProfile();

    await page.fill('Name', 'Olena K.');
    page.click('Save');
    page.http.expectOne(PROFILE_UPDATE).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.text()).toContain("Can't reach the server");
    expect(page.toolbarText()).toContain(LOGGED_IN.user.displayName);
    expect(page.toolbarText()).not.toContain('Olena K.');
  });
});
