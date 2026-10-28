import { HttpTestingController } from '@angular/common/http/testing';
import { Task, TodoList } from '@api';
import { Locale } from './locale';
import { DESKTOP, emulateMedia } from './media';
import { renderRoute } from './routed-page';
import { LAZY_ROUTE_WAIT } from './session';
import { tasksRequest } from './tasks';
import { todoListRequest } from './todo-lists';

/**
 * A Todo List's own page, with `tasks` as its Tasks, and with it and `others` in the drawer.
 * Renders in English unless told otherwise.
 */
export async function renderTodoListPage(
  todoList: TodoList,
  {
    others = [],
    tasks = [],
    locale,
  }: { others?: TodoList[]; tasks?: Task[]; locale?: Locale } = {},
) {
  emulateMedia(DESKTOP);
  const page = await renderRoute(`/lists/${todoList.id}`, {
    locale,
    todoLists: [todoList, ...others],
  });
  await answerTodoListPage(page.http, todoList, tasks);
  await page.text();
  return page;
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

/** Answers what a Todo List's page asks for as it opens: the Todo List, then its Tasks. */
export async function answerTodoListPage(
  http: HttpTestingController,
  todoList: TodoList,
  tasks: Task[] = [],
): Promise<void> {
  await vi
    .waitFor(() => http.expectOne(todoListRequest('GET', todoList.id)), LAZY_ROUTE_WAIT)
    .then((request) => request.flush(todoList));
  await vi
    .waitFor(() => http.expectOne(tasksRequest('GET', todoList.id)))
    .then((request) => request.flush(tasks));
}
