import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerEvents } from '../../testing/events';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT } from '../../testing/session';
import { answerTasks, BREAD, EGGS, MILK, moveRequest, pageOf } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { GROCERIES, todoListRequest } from '../../testing/todo-lists';

const OPEN = { completed: 'false' };
const COMPLETED = { completed: 'true' };

describe('Querying Tasks', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** A Todo List's page opened at this URL, with the Todo List answered but not yet its Tasks. */
  async function renderAt(url: string) {
    emulateMedia(DESKTOP);
    const page = await renderRoute(url, { todoLists: [GROCERIES] });
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', 5)), LAZY_ROUTE_WAIT)
      .then((request) => request.flush(GROCERIES));
    // Once loaded, the page follows the Todo List's events
    await answerEvents(page.http, 5);
    return page;
  }

  it('searches the Tasks, keeping the search in the URL', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD, EGGS] });

    await page.fill('Search Tasks', ' milk ');
    page.click('Search');
    await answerTasks(page.http, 5, { ...OPEN, q: 'milk' }, pageOf([MILK]));
    await answerTasks(page.http, 5, { ...COMPLETED, q: 'milk' }, pageOf([]));

    expect(await page.url()).toBe('/lists/5?q=milk');
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
    expect(page.has('Completed (0)')).toBe(false);
  });

  it('filters and sorts the Tasks as chosen, keeping the choices in the URL', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

    // Each choice waits for the page to settle, which it does once the Tasks are answered
    let chosen = page.choose('Show', 'Open Tasks');
    await answerTasks(page.http, 5, OPEN, pageOf([MILK, BREAD]));
    await chosen;
    chosen = page.choose('Sort by', 'Due Date');
    await answerTasks(page.http, 5, { ...OPEN, sort: 'DUE_DATE' }, pageOf([BREAD, MILK]));
    await chosen;
    chosen = page.checkbox('Overdue only').then((overdueOnly) => overdueOnly.check());
    await answerTasks(page.http, 5, { ...OPEN, sort: 'DUE_DATE', overdue: 'true' }, pageOf([]));
    await chosen;
    chosen = page.choose('Priorities', 'High');
    await answerTasks(
      page.http,
      5,
      { ...OPEN, sort: 'DUE_DATE', overdue: 'true', priority: 'HIGH' },
      pageOf([]),
    );
    await chosen;

    expect(await page.url()).toBe('/lists/5?show=open&priority=HIGH&overdue=true&sort=DUE_DATE');
    expect(await page.text()).toContain('No Tasks match the search and filters.');
  });

  it('restores the view from the URL, as on reloading the page', async () => {
    const page = await renderAt(
      '/lists/5?show=open&priority=HIGH&priority=LOW&dueFrom=2026-11-01&dueTo=2026-11-30' +
        '&overdue=true&sort=PRIORITY&q=milk&page=2',
    );

    await answerTasks(
      page.http,
      5,
      {
        ...OPEN,
        priority: ['HIGH', 'LOW'],
        dueFrom: '2026-11-01',
        dueTo: '2026-11-30',
        overdue: 'true',
        sort: 'PRIORITY',
        q: 'milk',
        page: '1',
      },
      pageOf([MILK], { page: 1, totalItems: 51 }),
    );

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
    expect(await page.chosen('Show')).toBe('Open Tasks');
    expect(await page.chosen('Priorities')).toBe('High, Low');
    expect(await page.chosen('Sort by')).toBe('Priority');
    expect(await page.fieldValue('Search Tasks')).toBe('milk');
    expect(await page.fieldValue('Due from')).toBe('2026-11-01');
    expect(await page.fieldValue('Due to')).toBe('2026-11-30');
    expect(await (await page.checkbox('Overdue only')).isChecked()).toBe(true);
    expect(await page.text()).toContain('Page 2 of 2');
  });

  it('ignores what makes no sense in the URL', async () => {
    const page = await renderAt('/lists/5?show=some&priority=URGENT&sort=SOMETIMES&page=-3');

    await answerTasks(page.http, 5, OPEN, pageOf([MILK]));
    await answerTasks(page.http, 5, COMPLETED, pageOf([]));

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  it('pages through the Tasks, keeping the page in the URL', async () => {
    const page = await renderAt('/lists/5');
    await answerTasks(page.http, 5, OPEN, pageOf([MILK], { totalItems: 120 }));
    await answerTasks(page.http, 5, COMPLETED, pageOf([EGGS]));
    expect(await page.text()).toContain('Page 1 of 3');
    expect(page.control('Previous page').hasAttribute('disabled')).toBe(true);

    page.click('Next page');
    await answerTasks(page.http, 5, { ...OPEN, page: '1' }, pageOf([BREAD], { totalItems: 120 }));

    expect(await page.url()).toBe('/lists/5?page=2');
    expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
    expect(await page.text()).toContain('Page 2 of 3');
    // Only the open Tasks page; the Completed ones stay as they are
    expect(page.has('Completed (1)')).toBe(true);
  });

  it('starts again from the first page when the filters change', async () => {
    const page = await renderAt('/lists/5?page=3');
    await answerTasks(page.http, 5, { ...OPEN, page: '2' }, pageOf([MILK], { totalItems: 120 }));
    await answerTasks(page.http, 5, COMPLETED, pageOf([]));

    const chosen = page.choose('Sort by', 'Title');
    await answerTasks(page.http, 5, { ...OPEN, sort: 'TITLE' }, pageOf([BREAD]));
    await answerTasks(page.http, 5, { ...COMPLETED, sort: 'TITLE' }, pageOf([]));
    await chosen;

    expect(await page.url()).toBe('/lists/5?sort=TITLE');
  });

  it('turns drag and drop off, and says why, while any filter, sort or search is on', async () => {
    const page = await renderAt('/lists/5?sort=TITLE');
    await answerTasks(page.http, 5, { ...OPEN, sort: 'TITLE' }, pageOf([BREAD, MILK]));
    await answerTasks(page.http, 5, { ...COMPLETED, sort: 'TITLE' }, pageOf([]));
    expect(await page.text()).toContain(
      'To drag Tasks into place, clear the search, filters and sort.',
    );

    await page.drag('Open Tasks', 1, 0);

    expect(page.listItems('Open Tasks')).toEqual(['Buy bread', 'Buy milk']);
    page.http.expectNone(moveRequest(5, MILK.id));
  });

  it('allows drag and drop, without saying anything, in the manual order', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

    expect(await page.text()).not.toContain('To drag Tasks into place');
    expect(document.querySelectorAll('.drag-handle')).toHaveLength(2);
  });

  it('clears the search, filters and sort at once', async () => {
    const page = await renderAt('/lists/5?show=open&q=milk&sort=TITLE&page=2');
    await answerTasks(
      page.http,
      5,
      { ...OPEN, q: 'milk', sort: 'TITLE', page: '1' },
      pageOf([], { page: 1, totalItems: 51 }),
    );

    page.click('Clear filters');
    await answerTasks(page.http, 5, OPEN, pageOf([MILK, BREAD]));
    await answerTasks(page.http, 5, COMPLETED, pageOf([EGGS]));

    expect(await page.url()).toBe('/lists/5');
    expect(page.has('Clear filters')).toBe(false);
    expect(await page.fieldValue('Search Tasks')).toBe('');
  });

  it('offers to show all Completed Tasks when there are more than the section holds', async () => {
    const page = await renderAt('/lists/5');
    await answerTasks(page.http, 5, OPEN, pageOf([MILK]));
    await answerTasks(page.http, 5, COMPLETED, pageOf([EGGS], { totalItems: 60 }));
    await page.text();
    page.click('Completed (60)');
    await page.text();

    page.click('Show all Completed Tasks');
    await answerTasks(page.http, 5, COMPLETED, pageOf([EGGS], { totalItems: 60 }));

    expect(await page.url()).toBe('/lists/5?show=completed');
    expect(page.listItems('Completed Tasks')).toEqual([
      'Buy eggs Completed Oct 27, 2026 at 2:00 PM',
    ]);
    expect(page.listItems('Open Tasks')).toBeUndefined();
    expect(await page.text()).toContain('Page 1 of 2');
  });
});
