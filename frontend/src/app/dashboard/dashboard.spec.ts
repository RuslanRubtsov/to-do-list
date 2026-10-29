import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dashboard, Priority, Task } from '@api';
import { APP_INFO_REQUEST, APP_INFO } from '../../testing/app-info';
import { answerDashboard, onDashboard } from '../../testing/dashboard';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute, snackBarText } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT } from '../../testing/session';
import { completionRequest, openTask } from '../../testing/tasks';
import { failAsNotFound, GARDEN, GROCERIES, TRIP } from '../../testing/todo-lists';

const NOW = new Date('2026-10-29T10:00:00Z');

const PAY_BILLS: Task = {
  ...openTask(31, 'Pay bills'),
  priority: Priority.HIGH,
  dueDate: '2026-10-28',
  overdue: true,
};
const MILK: Task = { ...openTask(21, 'Buy milk'), dueDate: '2026-10-29' };
const WATER: Task = { ...openTask(41, 'Water plants'), dueDate: '2026-10-29' };
const FLIGHTS: Task = { ...openTask(32, 'Book flights'), dueDate: '2026-11-01' };

/** Olena's: Groceries are hers, Garden is Shared with her as an Editor. */
const DASHBOARD: Dashboard = {
  counts: { open: 8, overdue: 1, dueToday: 2, completedThisWeek: 1 },
  overdue: [onDashboard(PAY_BILLS, GROCERIES)],
  dueToday: [onDashboard(WATER, GARDEN), onDashboard(MILK, GROCERIES)],
  upcoming: [onDashboard(FLIGHTS, GROCERIES)],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  /** The start page, which a User lands on, with this dashboard. */
  async function renderDashboard(dashboard: Dashboard = DASHBOARD) {
    emulateMedia(DESKTOP);
    const page = await renderRoute('/', { todoLists: [GARDEN, GROCERIES] });
    await vi
      .waitFor(() => page.http.expectOne(APP_INFO_REQUEST), LAZY_ROUTE_WAIT)
      .then((request) => request.flush(APP_INFO));
    await answerDashboard(page.http, dashboard);
    await page.text();
    return page;
  }

  it('shows what needs attention across the User’s Todo Lists, with the Todo List of each Task', async () => {
    const page = await renderDashboard();

    expect(page.listItems('Overdue')).toEqual(['Pay bills Groceries Due yesterday']);
    expect(page.listItems('Due today')).toEqual([
      'Water plants Garden Due today',
      'Buy milk Groceries Due today',
    ]);
    expect(page.listItems('Next 7 days')).toEqual(['Book flights Groceries Due Nov 1, 2026']);
  });

  it('links each Task to its Todo List', async () => {
    const page = await renderDashboard();

    expect(page.control('Garden').getAttribute('href')).toBe(`/lists/${GARDEN.id}`);
    expect(page.control('Groceries').getAttribute('href')).toBe(`/lists/${GROCERIES.id}`);
  });

  it('counts open, Overdue, due today and Completed this week', async () => {
    const page = await renderDashboard();

    const text = await page.text();
    expect(text).toContain('8 open Tasks');
    expect(text).toContain('1 Overdue Task');
    expect(text).toContain('2 Tasks due today');
    expect(text).toContain('1 Task Completed this week');
  });

  it('says when nothing is due in the next 7 days', async () => {
    const page = await renderDashboard({
      ...DASHBOARD,
      counts: { open: 1, overdue: 0, dueToday: 0, completedThisWeek: 0 },
      overdue: [],
      dueToday: [],
      upcoming: [],
    });

    expect(await page.text()).toContain('Nothing is Overdue or due in the next 7 days.');
    expect(page.listItems('Overdue')).toBeUndefined();
  });

  it('completes a Task in place, counting it', async () => {
    const page = await renderDashboard();

    await (await page.checkbox('Buy milk')).check();
    page.http
      .expectOne(completionRequest('PUT', GROCERIES.id, MILK.id))
      .flush({ ...MILK, completedAt: NOW.toISOString() });

    const text = await page.text();
    expect(page.listItems('Due today')).toEqual(['Water plants Garden Due today']);
    expect(text).toContain('7 open Tasks');
    expect(text).toContain('1 Task due today');
    expect(text).toContain('2 Tasks Completed this week');
    expect(page.has('Groceries, 2 open Tasks')).toBe(true);
  });

  it('puts the Task back, and says so, when completing it fails', async () => {
    const page = await renderDashboard();

    await (await page.checkbox('Pay bills')).check();
    page.http
      .expectOne(completionRequest('PUT', GROCERIES.id, PAY_BILLS.id))
      .error(new ProgressEvent('error'), { status: 0 });

    await page.text();
    expect(page.listItems('Overdue')).toEqual(['Pay bills Groceries Due yesterday']);
    expect(await (await page.checkbox('Pay bills')).isChecked()).toBe(false);
    expect(snackBarText()).toContain('Couldn’t change “Pay bills”.');
  });

  it('loads the dashboard again when completing finds the Task or its Todo List gone', async () => {
    const page = await renderDashboard();

    await (await page.checkbox('Buy milk')).check();
    failAsNotFound(page.http.expectOne(completionRequest('PUT', GROCERIES.id, MILK.id)));
    await answerDashboard(page.http, { ...DASHBOARD, dueToday: [onDashboard(WATER, GARDEN)] });

    await page.text();
    expect(page.listItems('Due today')).toEqual(['Water plants Garden Due today']);
    expect(snackBarText()).not.toContain('Couldn’t change');
  });

  it('lets a Viewer see a Task but not complete it', async () => {
    const page = await renderDashboard({ ...DASHBOARD, dueToday: [onDashboard(WATER, TRIP)] });

    expect(await (await page.checkbox('Water plants')).isDisabled()).toBe(true);
    expect(await (await page.checkbox('Pay bills')).isDisabled()).toBe(false);
  });
});
