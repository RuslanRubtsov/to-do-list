import { HttpTestingController } from '@angular/common/http/testing';
import { Task, TodoList } from '@api';
import { answerEvents, FakeEventStream } from './events';
import { Locale } from './locale';
import { DESKTOP, emulateMedia } from './media';
import { renderRoute } from './routed-page';
import { LAZY_ROUTE_WAIT } from './session';
import { pageOf } from './tasks';
import { todoListRequest } from './todo-lists';

/**
 * A Todo List's own page, with `tasks` as its Tasks, and with it and `others` in the drawer.
 * Renders in English, in the default view, unless told otherwise: `query` is the URL's query
 * string for another view, such as `'?sort=TITLE'`.
 */
export async function renderTodoListPage(
  todoList: TodoList,
  {
    others = [],
    tasks = [],
    locale,
    query = '',
  }: { others?: TodoList[]; tasks?: Task[]; locale?: Locale; query?: string } = {},
) {
  emulateMedia(DESKTOP);
  const page = await renderRoute(`/lists/${todoList.id}${query}`, {
    locale,
    todoLists: [todoList, ...others],
  });
  const events = await answerTodoListPage(page.http, todoList, tasks);
  await page.text();
  return Object.assign(page, { events });
}

/**
 * Clicks the button that opens a Task's details, and waits for the dialog. It loads on first use,
 * bringing date-fns, which under a parallel run takes longer than a lazy route.
 */
export async function openDetails(
  page: Awaited<ReturnType<typeof renderRoute>>,
  label: string,
): Promise<void> {
  page.click(label);
  await vi.waitFor(() => {
    if (!document.querySelector('mat-dialog-container form')) throw new Error('No dialog yet');
  }, DIALOG_LOAD_WAIT);
}

const DIALOG_LOAD_WAIT = { ...LAZY_ROUTE_WAIT, timeout: 15_000 };

/**
 * Answers what a Todo List's page asks for as it opens in a view that shows both open and
 * Completed Tasks: the Todo List, then its open Tasks and its Completed ones, each in one page,
 * whatever else the view asks for. Last, it follows the Todo List's events: that stream is returned,
 * started, for tests to send events on.
 */
export async function answerTodoListPage(
  http: HttpTestingController,
  todoList: TodoList,
  tasks: Task[] = [],
): Promise<FakeEventStream> {
  await vi
    .waitFor(() => http.expectOne(todoListRequest('GET', todoList.id)), LAZY_ROUTE_WAIT)
    .then((request) => request.flush(todoList));
  const open = tasks.filter((task) => !task.completedAt);
  const completed = tasks.filter((task) => task.completedAt);
  for (const [completedOnes, tasksOf] of [
    ['false', open],
    ['true', completed],
  ] as const) {
    await vi
      .waitFor(() =>
        http.expectOne(
          (request) =>
            request.method === 'GET' &&
            request.url === `/api/v1/todo-lists/${todoList.id}/tasks` &&
            request.params.get('completed') === completedOnes,
        ),
      )
      .then((request) => request.flush(pageOf(tasksOf)));
  }
  return answerEvents(http, todoList.id);
}
