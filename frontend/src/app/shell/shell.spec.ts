import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DESKTOP, emulateMedia, Media, PHONE } from '../../testing/media';
import { LOGOUT } from '../../testing/session';
import { renderShell } from '../../testing/shell';
import { THEME_STORAGE_KEY as THEME_KEY } from './theme';

function colorScheme(): string {
  return document.documentElement.style.colorScheme;
}

describe('App shell', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
    vi.restoreAllMocks();
  });

  it('shows the app name in the toolbar', async () => {
    emulateMedia(DESKTOP);
    const shell = await renderShell();

    expect(await shell.text()).toContain('To-Do');
  });

  describe('logged-in User', () => {
    it('is named in the toolbar', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      expect(await shell.text()).toContain('Olena');
    });

    it('logs out, ending the session on the server, and lands on the login page', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      shell.click('Log out');
      shell.http.expectOne(LOGOUT).flush(null, { status: 204, statusText: 'No Content' });

      expect(await shell.url()).toBe('/login');
    });

    it('stays logged in, and says so, when the server could not end the session', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      shell.click('Log out');
      shell.http.expectOne(LOGOUT).error(new ProgressEvent('error'), { status: 0 });

      expect(await shell.url()).toBe('/');
      // The snack bar opens in an overlay outside the routed page
      expect(document.body.textContent).toContain("Couldn't log out.");
      expect(shell.has('Log out')).toBe(true);
    });
  });

  describe('navigation drawer', () => {
    it('is a side panel that stays open on desktop', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      const drawer = await shell.drawer();
      expect(await drawer.getMode()).toBe('side');
      expect(await drawer.isOpen()).toBe(true);
      expect(shell.has('Open navigation')).toBe(false);
    });

    it('is a closed overlay on phones that the menu button opens', async () => {
      emulateMedia(PHONE);
      const shell = await renderShell();
      const drawer = await shell.drawer();
      expect(await drawer.getMode()).toBe('over');
      expect(await drawer.isOpen()).toBe(false);

      shell.click('Open navigation');

      expect(await drawer.isOpen()).toBe(true);
    });

    it('is a navigation landmark screen readers can find by name', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      expect(shell.navigation('Navigation')).toBeDefined();
    });

    it('tells screen readers whether the phone drawer is open', async () => {
      emulateMedia(PHONE);
      const shell = await renderShell();
      const menu = () => shell.control('Open navigation');
      expect(menu().getAttribute('aria-expanded')).toBe('false');

      shell.click('Open navigation');
      await shell.text();
      expect(menu().getAttribute('aria-expanded')).toBe('true');

      shell.click('Home');
      await shell.text();
      expect(menu().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on phones once a destination is chosen', async () => {
      emulateMedia(PHONE);
      const shell = await renderShell();
      shell.click('Open navigation');

      shell.click('Home');

      expect(await (await shell.drawer()).isOpen()).toBe(false);
    });

    it('becomes a side panel when the window widens', async () => {
      const resize = emulateMedia(PHONE);
      const shell = await renderShell();

      await resize({ width: DESKTOP.width });
      await shell.text();

      const drawer = await shell.drawer();
      expect(await drawer.getMode()).toBe('side');
      expect(await drawer.isOpen()).toBe(true);
    });

    it('links to the API documentation', async () => {
      emulateMedia(DESKTOP);
      const shell = await renderShell();

      expect(shell.has('API documentation')).toBe(true);
    });
  });

  describe('theme', () => {
    const SYSTEM_DARK: Media = { ...DESKTOP, prefersDark: true };

    it('follows the system preference until one is chosen', async () => {
      emulateMedia(SYSTEM_DARK);
      const shell = await renderShell();

      expect(colorScheme()).toBe('');
      expect(shell.has('Switch to light theme')).toBe(true);
    });

    it('keeps following the system preference as it changes', async () => {
      const change = emulateMedia(SYSTEM_DARK);
      const shell = await renderShell();

      await change({ prefersDark: false });
      await shell.text();

      expect(shell.has('Switch to dark theme')).toBe(true);
    });

    it('switches theme and remembers the choice in this browser', async () => {
      emulateMedia(SYSTEM_DARK);
      const shell = await renderShell();

      shell.click('Switch to light theme');
      await shell.text();

      expect(colorScheme()).toBe('light');
      expect(shell.has('Switch to dark theme')).toBe(true);
      expect(localStorage.getItem(THEME_KEY)).toBe('light');
    });

    it('starts with the remembered theme', async () => {
      emulateMedia(SYSTEM_DARK);
      localStorage.setItem(THEME_KEY, 'light');

      const shell = await renderShell();

      expect(colorScheme()).toBe('light');
      expect(shell.has('Switch to dark theme')).toBe(true);
    });

    it('still switches theme when the browser refuses storage', async () => {
      emulateMedia(SYSTEM_DARK);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Storage is disabled', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage is disabled', 'SecurityError');
      });
      const shell = await renderShell();

      shell.click('Switch to light theme');
      await shell.text();

      expect(colorScheme()).toBe('light');
    });

    it('ignores an unrecognised remembered value', async () => {
      emulateMedia(SYSTEM_DARK);
      localStorage.setItem(THEME_KEY, 'sepia');

      const shell = await renderShell();

      expect(colorScheme()).toBe('');
      expect(shell.has('Switch to light theme')).toBe(true);
    });
  });
});
