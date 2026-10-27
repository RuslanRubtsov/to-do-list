import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppInfo } from '@api';
import { renderRoute } from '../../testing/routed-page';

/** Locale smoke test: the start page rendered with the Ukrainian translations and locale data. */
describe('Start page in Ukrainian', () => {
  const NOW = new Date('2026-10-27T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  async function renderBuiltDaysAgo(days: number): Promise<string> {
    const buildTime = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const appInfo: AppInfo = { name: 'todo-backend', version: '1.4.2', buildTime };
    const page = await renderRoute('/', { locale: 'uk' });
    page.http.expectOne('/api/v1/app-info').flush(appInfo);
    return page.text();
  }

  it('translates labels and formats dates the Ukrainian way', async () => {
    const text = await renderBuiltDaysAgo(5);

    expect(text).toContain('Версія');
    // The locale data puts a narrow no-break space before "р."
    expect(text).toMatch(/22 жовт\. 2026\sр\./);
  });

  it.each([
    [0, 'сьогодні'],
    [1, 'вчора'],
    [21, '21 день тому'], // one
    [3, '3 дні тому'], // few
    [5, '5 днів тому'], // many
    [12, '12 днів тому'], // many, despite ending in 2
  ])('uses the right plural form for %i days', async (days, expected) => {
    expect(await renderBuiltDaysAgo(days)).toContain(expected);
  });

  it('groups thousands with a space', async () => {
    expect(await renderBuiltDaysAgo(1234)).toMatch(/1\s234 дні тому/);
  });
});
