import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TodoList } from '@api';
import { answerAppInfo } from '../../testing/app-info';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { LAZY_ROUTE_WAIT, LOGOUT } from '../../testing/session';
import {
  CREATE_TODO_LIST,
  failAsNotFound,
  failNameAsInvalid,
  GROCERIES,
  todoListRequest,
  WORK,
} from '../../testing/todo-lists';

/** The start page, with the User's Todo Lists in the drawer. */
async function renderStart(todoLists: TodoList[]) {
  emulateMedia(DESKTOP);
  const page = await renderRoute('/', { todoLists });
  await answerAppInfo(page.http);
  await page.text();
  return page;
}

/** A Todo List's own page, with it also in the drawer. */
async function renderTodoList(todoList: TodoList, others: TodoList[] = []) {
  emulateMedia(DESKTOP);
  const page = await renderRoute(`/lists/${todoList.id}`, { todoLists: [todoList, ...others] });
  const request = await vi.waitFor(
    () => page.http.expectOne(todoListRequest('GET', todoList.id)),
    LAZY_ROUTE_WAIT,
  );
  request.flush(todoList);
  await page.text();
  return page;
}

/** Longer than Undo is offered for, with time for the snack bar to leave. */
const UNDO_TIME = 6000;

/** The text of the snack bar, which opens in an overlay outside the routed page. */
function snackBarText(): string {
  return document.querySelector('mat-snack-bar-container')?.textContent ?? '';
}

describe('Todo Lists', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  describe('in the navigation drawer', () => {
    it("lists the User's Todo Lists, each with its count of open Tasks", async () => {
      const page = await renderStart([GROCERIES, WORK]);

      expect(page.control('Groceries, 3 open Tasks').getAttribute('href')).toBe('/lists/5');
      expect(page.control('Work, no open Tasks').getAttribute('href')).toBe('/lists/8');
    });

    it('says when the User has none yet', async () => {
      const page = await renderStart([]);

      expect(await page.text()).toContain('No Todo Lists yet.');
    });

    it('opens a Todo List', async () => {
      const page = await renderStart([GROCERIES]);

      page.click('Groceries, 3 open Tasks');
      await vi
        .waitFor(() => page.http.expectOne(todoListRequest('GET', 5)), LAZY_ROUTE_WAIT)
        .then((request) => request.flush(GROCERIES));

      expect(await page.url()).toBe('/lists/5');
      expect(page.heading()).toBe('Groceries');
    });
  });

  describe('creating', () => {
    it('creates a Todo List and opens it', async () => {
      const page = await renderStart([WORK]);

      page.click('New Todo List');
      await page.fill('Name', 'Groceries');
      page.click('Create');
      const create = page.http.expectOne(CREATE_TODO_LIST);
      expect(create.request.body).toEqual({ name: 'Groceries' });
      create.flush({ ...GROCERIES, openTaskCount: 0 });
      await vi
        .waitFor(() => page.http.expectOne(todoListRequest('GET', 5)), LAZY_ROUTE_WAIT)
        .then((request) => request.flush({ ...GROCERIES, openTaskCount: 0 }));

      expect(await page.url()).toBe('/lists/5');
      expect(page.heading()).toBe('Groceries');
      expect(page.has('Groceries, no open Tasks')).toBe(true);
    });

    it('asks for a name instead of creating a Todo List without one', async () => {
      const page = await renderStart([]);

      page.click('New Todo List');
      await page.fill('Name', '   ');
      page.click('Create');

      expect(await page.fieldErrors('Name')).toEqual(['Enter a name.']);
      page.http.expectNone(CREATE_TODO_LIST);
    });

    it('shows the error the server gives for the name next to it', async () => {
      const page = await renderStart([]);

      page.click('New Todo List');
      await page.fill('Name', 'Groceries');
      page.click('Create');
      failNameAsInvalid(page.http.expectOne(CREATE_TODO_LIST), 'SIZE');

      expect(await page.fieldErrors('Name')).toEqual(['Use at most 100 characters.']);
      expect(await page.url()).toBe('/');
    });

    it('creates nothing when cancelled', async () => {
      const page = await renderStart([]);

      page.click('New Todo List');
      await page.fill('Name', 'Groceries');
      page.click('Cancel');

      expect(await page.text()).toContain('No Todo Lists yet.');
      page.http.expectNone(CREATE_TODO_LIST);
    });
  });

  describe('renaming', () => {
    it('renames the Todo List, here and in the drawer', async () => {
      const page = await renderTodoList(GROCERIES);

      page.click('Rename Todo List');
      await page.fill('Name', 'Shopping');
      page.click('Rename');
      const rename = page.http.expectOne(todoListRequest('PATCH', 5));
      expect(rename.request.body).toEqual({ name: 'Shopping' });
      rename.flush({ ...GROCERIES, name: 'Shopping' });

      await vi.waitFor(() => expect(page.heading()).toBe('Shopping'));
      expect(page.has('Shopping, 3 open Tasks')).toBe(true);
      expect(page.has('Groceries, 3 open Tasks')).toBe(false);
    });

    it('asks for a name instead of renaming to a blank one', async () => {
      const page = await renderTodoList(GROCERIES);

      page.click('Rename Todo List');
      await page.fill('Name', '');
      page.click('Rename');

      expect(await page.fieldErrors('Name')).toEqual(['Enter a name.']);
      page.http.expectNone(todoListRequest('PATCH', 5));
    });
  });

  describe('deleting', () => {
    /** Deletes the open Todo List, confirming, which leaves its page for the start page. */
    async function deleteConfirmed(page: Awaited<ReturnType<typeof renderTodoList>>) {
      page.click('Delete Todo List');
      await page.text();
      page.click('Delete');
      await answerAppInfo(page.http);
      await page.text();
    }

    it('asks for confirmation first, and deletes nothing when cancelled', async () => {
      const page = await renderTodoList(GROCERIES);

      page.click('Delete Todo List');
      expect(document.body.textContent).toContain('Delete “Groceries”?');
      page.click('Cancel');

      expect(await page.url()).toBe('/lists/5');
      expect(page.has('Groceries, 3 open Tasks')).toBe(true);
      page.http.expectNone(todoListRequest('DELETE', 5));
    });

    it('hides the Todo List at once, but sends nothing until Undo has had its time', async () => {
      // Time runs as usual, unless the test moves it on
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const page = await renderTodoList(GROCERIES, [WORK]);

      await deleteConfirmed(page);

      expect(await page.url()).toBe('/');
      expect(page.has('Groceries, 3 open Tasks')).toBe(false);
      expect(page.has('Work, no open Tasks')).toBe(true);
      expect(snackBarText()).toContain('Deleted “Groceries”.');
      page.http.expectNone(todoListRequest('DELETE', 5));

      await vi.advanceTimersByTimeAsync(UNDO_TIME);
      page.http
        .expectOne(todoListRequest('DELETE', 5))
        .flush(null, { status: 204, statusText: 'No Content' });

      await page.text();
      expect(page.has('Groceries, 3 open Tasks')).toBe(false);
    });

    it('brings the Todo List back on Undo, sending nothing', async () => {
      const page = await renderTodoList(GROCERIES);

      await deleteConfirmed(page);
      page.click('Undo');

      await vi.waitFor(() => expect(page.has('Groceries, 3 open Tasks')).toBe(true));
      page.http.expectNone(todoListRequest('DELETE', 5));
    });

    it('sends the delete when its snack bar is dismissed by the next one', async () => {
      const page = await renderTodoList(GROCERIES, [WORK]);
      await deleteConfirmed(page);

      page.click('Work, no open Tasks');
      await vi
        .waitFor(() => page.http.expectOne(todoListRequest('GET', 8)), LAZY_ROUTE_WAIT)
        .then((request) => request.flush(WORK));
      await page.text();
      await deleteConfirmed(page);

      await vi
        .waitFor(() => page.http.expectOne(todoListRequest('DELETE', 5)))
        .then((request) => request.flush(null, { status: 204, statusText: 'No Content' }));
      expect(snackBarText()).toContain('Deleted “Work”.');
    });

    it('sends the delete before logging out, while the session still can', async () => {
      const page = await renderTodoList(GROCERIES);
      await deleteConfirmed(page);

      page.click('Log out');
      page.http.expectNone(LOGOUT);
      page.http
        .expectOne(todoListRequest('DELETE', 5))
        .flush(null, { status: 204, statusText: 'No Content' });
      page.http.expectOne(LOGOUT).flush(null, { status: 204, statusText: 'No Content' });

      expect(await page.url()).toBe('/login');
    });

    it('brings the Todo List back, and says so, when the delete fails', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const page = await renderTodoList(GROCERIES);
      await deleteConfirmed(page);

      await vi.advanceTimersByTimeAsync(UNDO_TIME);
      page.http
        .expectOne(todoListRequest('DELETE', 5))
        .error(new ProgressEvent('error'), { status: 0 });

      await vi.waitFor(() => expect(page.has('Groceries, 3 open Tasks')).toBe(true));
      expect(snackBarText()).toContain('Couldn’t delete “Groceries”.');
    });
  });

  it("says a Todo List that isn't the User's isn't available", async () => {
    emulateMedia(DESKTOP);
    const page = await renderRoute('/lists/99', { todoLists: [GROCERIES] });
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', 99)), LAZY_ROUTE_WAIT)
      .then(failAsNotFound);

    expect(await page.text()).toContain('This Todo List isn’t available.');
    expect(page.has('Rename Todo List')).toBe(false);
    expect(page.has('Delete Todo List')).toBe(false);
  });
});
