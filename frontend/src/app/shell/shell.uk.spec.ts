import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { emulateMedia, PHONE } from '../../testing/media';
import { LOGGED_IN } from '../../testing/session';
import { renderShell } from '../../testing/shell';

/** Locale smoke test: the shell's controls, rendered with the Ukrainian translations. */
describe('App shell in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('labels its controls in Ukrainian', async () => {
    emulateMedia(PHONE);
    const shell = await renderShell({ locale: 'uk' });

    expect(shell.has('Відкрити навігацію')).toBe(true);
    expect(shell.has('Увімкнути темну тему')).toBe(true);
    expect(shell.has('Головна')).toBe(true);
    expect(shell.has('Документація API')).toBe(true);
    expect(shell.has('Вийти')).toBe(true);
  });

  it('switches to English: saves the preference, then opens this page in English', async () => {
    emulateMedia(PHONE);
    const shell = await renderShell({ locale: 'uk' });
    expect(shell.control('English').getAttribute('lang')).toBe('en');

    shell.click('English');
    const update = shell.http.expectOne({ method: 'PATCH', url: '/api/v1/users/me' });
    expect(update.request.body).toEqual({ preferredLanguage: 'en' });
    update.flush({ ...LOGGED_IN.user, preferredLanguage: 'en' });

    await vi.waitFor(() => expect(shell.pageLoads()).toEqual(['/en/']));
  });
});
