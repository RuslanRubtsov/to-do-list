import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { emulateMedia, PHONE } from '../../testing/media';
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
});
