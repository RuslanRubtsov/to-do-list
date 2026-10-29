import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT } from '../../testing/session';
import { answerTasks, completionRequest, MILK, pageOf, tasksRequest } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { failAsNotFound, GARDEN, GROCERIES, todoListRequest } from '../../testing/todo-lists';

/**
 * A Todo List the User had open, or still has in the drawer, that is no longer theirs to reach: its
 * Owner stopped Sharing it with them, or deleted it.
 */
describe('A Todo List no longer available', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('says so once a change to it finds it gone, and drops it from the drawer', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK], others: [GROCERIES] });

    await (await page.checkbox('Buy milk')).check();
    failAsNotFound(page.http.expectOne(completionRequest('PUT', GARDEN.id, MILK.id)));
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)))
      .then(failAsNotFound);
    // The Tasks reload, and find it gone too
    for (const request of page.http.match((r) => r.url.endsWith('/tasks'))) failAsNotFound(request);

    expect(await page.text()).toContain(
      '“Garden” is no longer available to you. Its Owner may have stopped Sharing it with you, or deleted it.',
    );
    expect(page.has('Garden, 1 open Task, Taras · Editor')).toBe(false);
    expect(page.has('Groceries, 3 open Tasks')).toBe(true);
    expect(page.has('Go to the start page')).toBe(true);
    expect(page.has('Add Task')).toBe(false);
  });

  it('says so once querying its Tasks again finds it gone', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    const chosen = page.choose('Sort by', 'Title');
    await vi.waitFor(() => {
      const queries = page.http.match((r) => r.url.endsWith('/tasks'));
      if (!queries.length) throw new Error('No query yet');
      queries.forEach(failAsNotFound);
    });
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)))
      .then(failAsNotFound);
    await chosen;

    expect(await page.text()).toContain('“Garden” is no longer available to you.');
  });

  it('carries on when only the Task changed is gone', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    await page.fill('New Task', 'Buy bread');
    page.click('Add Task');
    failAsNotFound(page.http.expectOne(tasksRequest('POST', GARDEN.id)));
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)))
      .then((request) => request.flush(GARDEN));
    await answerTasks(page.http, GARDEN.id, { completed: 'false' }, pageOf([MILK]));
    await answerTasks(page.http, GARDEN.id, { completed: 'true' }, pageOf([]));

    expect(await page.text()).not.toContain('no longer available');
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  it('drops one from the drawer when opening it finds it gone', async () => {
    emulateMedia(DESKTOP);
    const page = await renderRoute(`/lists/${GARDEN.id}`, { todoLists: [GARDEN, GROCERIES] });
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)), LAZY_ROUTE_WAIT)
      .then(failAsNotFound);

    expect(await page.text()).toContain('This Todo List isn’t available.');
    expect(page.has('Garden, 2 open Tasks, Taras · Editor')).toBe(false);
    expect(page.has('Groceries, 3 open Tasks')).toBe(true);
  });
});
