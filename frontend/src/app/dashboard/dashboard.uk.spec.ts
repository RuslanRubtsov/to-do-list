import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardCounts } from '@api';
import { APP_INFO, APP_INFO_REQUEST } from '../../testing/app-info';
import { answerDashboard, EMPTY_DASHBOARD } from '../../testing/dashboard';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT } from '../../testing/session';

/** Locale smoke test: the dashboard's counts, with the Ukrainian plural forms. */
describe('Dashboard in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function renderCounts(counts: DashboardCounts) {
    emulateMedia(DESKTOP);
    const page = await renderRoute('/', { locale: 'uk' });
    await vi
      .waitFor(() => page.http.expectOne(APP_INFO_REQUEST), LAZY_ROUTE_WAIT)
      .then((request) => request.flush(APP_INFO));
    await answerDashboard(page.http, { ...EMPTY_DASHBOARD, counts });
    return page.text();
  }

  it('counts with the plural form each number takes', async () => {
    const text = await renderCounts({ open: 21, overdue: 3, dueToday: 5, completedThisWeek: 1 });

    expect(text).toContain('21 невиконане завдання');
    expect(text).toContain('3 прострочені завдання');
    expect(text).toContain('5 завдань на сьогодні');
    expect(text).toContain('1 завдання виконано цього тижня');
    expect(text).toContain('Немає ні прострочених завдань, ні завдань на найближчі 7 днів.');
  });

  it('counts many with the many form', async () => {
    const text = await renderCounts({ open: 12, overdue: 0, dueToday: 22, completedThisWeek: 11 });

    expect(text).toContain('12 невиконаних завдань');
    expect(text).toContain('0 прострочених завдань');
    expect(text).toContain('22 завдання на сьогодні');
    expect(text).toContain('11 завдань виконано цього тижня');
  });
});
