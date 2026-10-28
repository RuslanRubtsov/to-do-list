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
