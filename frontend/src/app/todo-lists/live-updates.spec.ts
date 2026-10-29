import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TodoListEvent, TodoListEventTypeEnum as Type } from '@api';
import { answerEvents, eventsRequest } from '../../testing/events';
import { LOGGED_IN } from '../../testing/session';
import { answerTasks, BREAD, MILK, pageOf } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { failAsNotFound, GARDEN, GROCERIES, todoListRequest } from '../../testing/todo-lists';

const OPEN = { completed: 'false' };
const COMPLETED = { completed: 'true' };

/** Changes others make to a Todo List the User has open, as they happen. */
describe('Live updates', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  function event(type: Type, details: Partial<TodoListEvent> = {}): TodoListEvent {
    return { type, todoListId: GARDEN.id, ...details };
  }

  it('shows a Task someone else adds', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    page.events.send(event(Type.TASK_CREATED, { task: BREAD }));
    await answerTasks(page.http, GARDEN.id, OPEN, pageOf([MILK, BREAD]));
    await answerTasks(page.http, GARDEN.id, COMPLETED, pageOf([]));

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']);
  });

  it.each([
    Type.TASK_UPDATED,
    Type.TASK_COMPLETED,
    Type.TASK_UNCOMPLETED,
    Type.TASK_MOVED,
    Type.TASK_DELETED,
  ])('shows the Tasks as they are after %s', async (type) => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK, BREAD] });

    page.events.send(event(type, { task: MILK, taskId: MILK.id }));
    await answerTasks(page.http, GARDEN.id, OPEN, pageOf([BREAD]));
    await answerTasks(page.http, GARDEN.id, COMPLETED, pageOf([]));

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy bread']);
  });

  it('shows the new name when the Todo List is renamed, in the drawer too', async () => {
    const page = await renderTodoListPage(GARDEN);

    page.events.send(event(Type.TODO_LIST_RENAMED, { name: 'Allotment', version: 2 }));

    await page.text();
    expect(page.heading()).toBe('Allotment');
    expect(page.has('Allotment, no open Tasks, Taras · Editor')).toBe(true);
  });

  it('says the Todo List is no longer available once it is deleted, and drops it from the drawer', async () => {
    const page = await renderTodoListPage(GARDEN, { others: [GROCERIES] });

    page.events.send(event(Type.TODO_LIST_DELETED));
    page.events.end();

    expect(await page.text()).toContain('“Garden” is no longer available to you.');
    expect(page.has('Garden, no open Tasks, Taras · Editor')).toBe(false);
    expect(page.has('Groceries, 3 open Tasks')).toBe(true);
  });

  it('says so when the User’s own Share is revoked', async () => {
    const page = await renderTodoListPage(GARDEN);

    page.events.send(event(Type.SHARE_REVOKED, { userId: LOGGED_IN.user.id }));
    page.events.end();

    expect(await page.text()).toContain('“Garden” is no longer available to you.');
    expect(page.has('Garden, no open Tasks, Taras · Editor')).toBe(false);
  });

  it('carries on when someone else’s Share is revoked', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    page.events.send(event(Type.SHARE_REVOKED, { userId: LOGGED_IN.user.id + 1 }));

    expect(await page.text()).not.toContain('no longer available');
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  it('ignores heartbeats', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    page.events.heartbeat();

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  it('follows the Todo List again after a network blip, catching up with what it missed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK] });

    page.events.drop();
    page.http.expectNone(eventsRequest(GARDEN.id));
    await vi.advanceTimersByTimeAsync(1000);
    const again = await answerEvents(page.http, GARDEN.id);
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)))
      .then((request) => request.flush(GARDEN));
    await answerTasks(page.http, GARDEN.id, OPEN, pageOf([MILK, BREAD]));
    await answerTasks(page.http, GARDEN.id, COMPLETED, pageOf([]));

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread']);

    again.send(event(Type.TASK_DELETED, { taskId: BREAD.id }));
    await answerTasks(page.http, GARDEN.id, OPEN, pageOf([MILK]));
    await answerTasks(page.http, GARDEN.id, COMPLETED, pageOf([]));
    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk']);
  });

  it('says so when following again finds the Todo List no longer the User’s to reach', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const page = await renderTodoListPage(GARDEN);

    page.events.drop();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => page.http.expectOne(eventsRequest(GARDEN.id))).then(failAsNotFound);
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GARDEN.id)))
      .then(failAsNotFound);

    expect(await page.text()).toContain('“Garden” is no longer available to you.');
    expect(page.has('Garden, no open Tasks, Taras · Editor')).toBe(false);
  });

  it('stops following the Todo List on leaving its page', async () => {
    const page = await renderTodoListPage(GARDEN, { others: [GROCERIES] });

    page.click('Groceries, 3 open Tasks');
    await vi
      .waitFor(() => page.http.expectOne(todoListRequest('GET', GROCERIES.id)))
      .then((request) => request.flush(GROCERIES));
    await answerTasks(page.http, GROCERIES.id, OPEN, pageOf([]));
    await answerTasks(page.http, GROCERIES.id, COMPLETED, pageOf([]));
    await answerEvents(page.http, GROCERIES.id);

    expect(page.events.request.cancelled).toBe(true);
  });
});
