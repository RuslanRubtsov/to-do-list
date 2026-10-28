import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute, snackBarText } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT } from '../../testing/session';
import {
  BREAD,
  completionRequest,
  deleteTaskRequest,
  EGGS,
  MILK,
  openTask,
  tasksRequest,
} from '../../testing/tasks';
import { answerTodoListPage, renderTodoListPage } from '../../testing/todo-list-page';
import { failFieldAsInvalid, GROCERIES, todoListRequest, WORK } from '../../testing/todo-lists';

/** Longer than Undo is offered for, with time for the snack bar to leave. */
const UNDO_TIME = 6000;

describe('Tasks', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  it("lists the Todo List's open Tasks", async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']);
  });

  it("says when the Tasks can't be loaded, and tries again on Retry", async () => {
    emulateMedia(DESKTOP);
    const page = await renderRoute('/lists/5', { todoLists: [GROCERIES] });
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', 5)), LAZY_ROUTE_WAIT)
      .then((request) => request.flush(GROCERIES));
    await vi
      .waitFor(() => page.http.expectOne(tasksRequest('GET', 5)))
      .then((request) => request.error(new ProgressEvent('error'), { status: 0 }));

    expect(await page.text()).toContain("Can't reach the server. Try again in a moment.");
    page.click('Retry');
    page.http.expectOne(tasksRequest('GET', 5)).flush([MILK]);

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  describe('adding', () => {
    it('adds a Task by its title alone, at the end', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK] });

      await page.fill('New Task', '  Buy bread ');
      page.click('Add Task');
      const add = page.http.expectOne(tasksRequest('POST', 5));
      expect(add.request.body).toEqual({ title: 'Buy bread' });
      add.flush(BREAD);

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']);
    });

    it('clears the field for the next Task', async () => {
      const page = await renderTodoListPage(GROCERIES);

      await page.fill('New Task', 'Buy milk');
      page.click('Add Task');
      page.http.expectOne(tasksRequest('POST', 5)).flush(openTask(30, 'Buy milk'));

      await page.text();
      expect(await page.fieldValue('New Task')).toBe('');
    });

    it('asks for a title instead of adding a Task without one', async () => {
      const page = await renderTodoListPage(GROCERIES);

      await page.fill('New Task', '  ');
      page.click('Add Task');

      expect(await page.fieldErrors('New Task')).toEqual(['Enter a title.']);
      page.http.expectNone(tasksRequest('POST', 5));
    });

    it('shows the error the server gives for the title next to it', async () => {
      const page = await renderTodoListPage(GROCERIES);

      await page.fill('New Task', 'Buy milk');
      page.click('Add Task');
      failFieldAsInvalid(page.http.expectOne(tasksRequest('POST', 5)), 'title', 'SIZE');

      expect(await page.fieldErrors('New Task')).toEqual(['Use at most 200 characters.']);
      expect(await page.fieldValue('New Task')).toBe('Buy milk');
    });

    it("keeps the title, and says so, when the server can't be reached", async () => {
      const page = await renderTodoListPage(GROCERIES);

      await page.fill('New Task', 'Buy milk');
      page.click('Add Task');
      page.http.expectOne(tasksRequest('POST', 5)).error(new ProgressEvent('error'), { status: 0 });

      expect(await page.text()).toContain("Can't reach the server. Try again in a moment.");
      expect(await page.fieldValue('New Task')).toBe('Buy milk');
      expect(page.listItems('Open Tasks')).toEqual([]);
    });
  });

  describe('completing', () => {
    it('gathers Completed Tasks in a collapsed section, showing when each was Completed', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, EGGS] });

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
      expect(page.control('Completed (1)').getAttribute('aria-expanded')).toBe('false');
      expect(page.listItems('Completed (1)')).toBeUndefined();

      page.click('Completed (1)');

      await page.text();
      expect(page.control('Completed (1)').getAttribute('aria-expanded')).toBe('true');
      expect(page.listItems('Completed (1)')).toEqual([
        'Buy eggs Completed Oct 27, 2026 at 2:00 PM',
      ]);
      expect(await (await page.checkbox('Buy eggs')).isChecked()).toBe(true);
    });

    it('completes a Task with one click', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

      await (await page.checkbox('Buy milk')).check();
      page.http
        .expectOne(completionRequest('PUT', 5, MILK.id))
        .flush({ ...MILK, completedAt: '2026-10-28T08:15:00Z' });

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
      page.click('Completed (1)');
      await page.text();
      expect(page.listItems('Completed (1)')).toEqual([
        'Buy milk Completed Oct 28, 2026 at 10:15 AM',
      ]);
    });

    it('shows a Task as Completed at once, and takes that back if completing fails', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

      await (await page.checkbox('Buy milk')).check();
      expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
      page.http
        .expectOne(completionRequest('PUT', 5, MILK.id))
        .error(new ProgressEvent('error'), { status: 0 });

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']);
      expect(await (await page.checkbox('Buy milk')).isChecked()).toBe(false);
      expect(snackBarText()).toContain('Couldn’t change “Buy milk”.');
    });

    it('un-completes a Task, putting it back among the open ones', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, EGGS, BREAD] });
      page.click('Completed (1)');

      await (await page.checkbox('Buy eggs')).uncheck();
      page.http
        .expectOne(completionRequest('DELETE', 5, EGGS.id))
        .flush({ ...EGGS, completedAt: null });

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy eggs', 'Buy bread']);
      expect(page.has('Completed (1)')).toBe(false);
    });

    it('starts the Completed section collapsed again once it has emptied', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, EGGS] });
      page.click('Completed (1)');
      await page.text();
      await (await page.checkbox('Buy eggs')).uncheck();
      page.http
        .expectOne(completionRequest('DELETE', 5, EGGS.id))
        .flush({ ...EGGS, completedAt: null });

      await (await page.checkbox('Buy milk')).check();
      page.http
        .expectOne(completionRequest('PUT', 5, MILK.id))
        .flush({ ...MILK, completedAt: '2026-10-28T08:15:00Z' });

      await page.text();
      expect(page.control('Completed (1)').getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('deleting', () => {
    it('hides the Task at once, but sends nothing until Undo has had its time', async () => {
      // Time runs as usual, unless the test moves it on
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

      page.click('Delete “Buy milk”');

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
      expect(snackBarText()).toContain('Deleted “Buy milk”.');
      page.http.expectNone(deleteTaskRequest(5, MILK.id));

      await vi.advanceTimersByTimeAsync(UNDO_TIME);
      page.http
        .expectOne(deleteTaskRequest(5, MILK.id))
        .flush(null, { status: 204, statusText: 'No Content' });

      await page.text();
      expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
    });

    it('brings the Task back on Undo, sending nothing', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });

      page.click('Delete “Buy milk”');
      await page.text();
      page.click('Undo');

      await vi.waitFor(() =>
        expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']),
      );
      page.http.expectNone(deleteTaskRequest(5, MILK.id));
    });

    it('deletes Completed Tasks too', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, EGGS] });
      page.click('Completed (1)');
      await page.text();

      page.click('Delete “Buy eggs”');

      await page.text();
      expect(page.has('Completed (1)')).toBe(false);
      await vi.advanceTimersByTimeAsync(UNDO_TIME);
      page.http
        .expectOne(deleteTaskRequest(5, EGGS.id))
        .flush(null, { status: 204, statusText: 'No Content' });
    });

    it('sends the delete on leaving the Todo List, which ends the offer of Undo', async () => {
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK], others: [WORK] });
      page.click('Delete “Buy milk”');
      await page.text();

      page.click('Work, no open Tasks');
      await answerTodoListPage(page.http, WORK);

      await vi
        .waitFor(() => page.http.expectOne(deleteTaskRequest(5, MILK.id)))
        .then((request) => request.flush(null, { status: 204, statusText: 'No Content' }));
      expect(await page.url()).toBe('/lists/8');
    });

    it('brings the Task back, and says so, when the delete fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD] });
      page.click('Delete “Buy milk”');
      await page.text();

      await vi.advanceTimersByTimeAsync(UNDO_TIME);
      page.http
        .expectOne(deleteTaskRequest(5, MILK.id))
        .error(new ProgressEvent('error'), { status: 0 });

      await vi.waitFor(() =>
        expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']),
      );
      expect(snackBarText()).toContain('Couldn’t delete “Buy milk”.');
    });
  });

  it("keeps the drawer's count of open Tasks up to date", async () => {
    const butter = openTask(24, 'Buy butter');
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD, butter] });
    expect(page.has('Groceries, 3 open Tasks')).toBe(true);

    await page.fill('New Task', 'Buy eggs');
    page.click('Add Task');
    page.http.expectOne(tasksRequest('POST', 5)).flush(openTask(25, 'Buy eggs'));
    await vi.waitFor(() => expect(page.has('Groceries, 4 open Tasks')).toBe(true));

    await (await page.checkbox('Buy milk')).check();
    await vi.waitFor(() => expect(page.has('Groceries, 3 open Tasks')).toBe(true));
    page.http
      .expectOne(completionRequest('PUT', 5, MILK.id))
      .flush({ ...MILK, completedAt: '2026-10-28T08:15:00Z' });

    page.click('Delete “Buy bread”');
    await vi.waitFor(() => expect(page.has('Groceries, 2 open Tasks')).toBe(true));
    page.click('Undo');
    await vi.waitFor(() => expect(page.has('Groceries, 3 open Tasks')).toBe(true));

    page.click('Completed (1)');
    await page.text();
    await (await page.checkbox('Buy milk')).uncheck();
    await vi.waitFor(() => expect(page.has('Groceries, 4 open Tasks')).toBe(true));
    page.http.expectOne(completionRequest('DELETE', 5, MILK.id)).flush(MILK);
  });
});
