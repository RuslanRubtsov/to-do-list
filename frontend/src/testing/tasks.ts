import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { Priority, Task, TaskPage } from '@api';

/** Adding a Task to a Todo List. */
export function tasksRequest(method: 'POST', todoListId: number) {
  return { method, url: `/api/v1/todo-lists/${todoListId}/tasks` };
}

/** How many Tasks the app asks for a page of. */
export const PAGE_SIZE = 50;

/**
 * A query for a Todo List's Tasks with exactly these parameters, apart from the page size. The page
 * is `0` unless given.
 */
export function tasksQuery(todoListId: number, params: Record<string, string | string[]>) {
  const expected: Record<string, string[]> = { page: ['0'] };
  for (const [name, value] of Object.entries(params)) {
    expected[name] = Array.isArray(value) ? value : [value];
  }
  return (request: HttpRequest<unknown>) => {
    if (request.method !== 'GET' || request.url !== `/api/v1/todo-lists/${todoListId}/tasks`) {
      return false;
    }
    const sent = request.params.keys().filter((name) => name !== 'size');
    return (
      sent.length === Object.keys(expected).length &&
      sent.every((name) => `${request.params.getAll(name)}` === `${expected[name]}`)
    );
  };
}

/** A page of Tasks as the backend sends one: these, of `totalItems` matching in all. */
export function pageOf(items: Task[], { page = 0, totalItems = items.length } = {}): TaskPage {
  return {
    items,
    page,
    size: PAGE_SIZE,
    totalItems,
    totalPages: Math.ceil(totalItems / PAGE_SIZE),
  };
}

/** Answers the query for the Todo List's Tasks with these parameters with a page of them. */
export async function answerTasks(
  http: HttpTestingController,
  todoListId: number,
  params: Record<string, string | string[]>,
  page: TaskPage,
): Promise<void> {
  const request = await vi.waitFor(() => http.expectOne(tasksQuery(todoListId, params)));
  request.flush(page);
}

/** The query for the Completed Tasks the default view shows beneath the open ones. */
export function completedQuery(todoListId: number) {
  return tasksQuery(todoListId, { completed: 'true' });
}

/** Reading a Task, changing its details, or deleting it. */
export function taskRequest(method: 'GET' | 'PUT' | 'DELETE', todoListId: number, taskId: number) {
  return { method, url: `/api/v1/todo-lists/${todoListId}/tasks/${taskId}` };
}

/** `PUT` completes the Task, `DELETE` un-completes it. */
export function completionRequest(method: 'PUT' | 'DELETE', todoListId: number, taskId: number) {
  return { method, url: `/api/v1/todo-lists/${todoListId}/tasks/${taskId}/completion` };
}

/** Moving a Task before or after another. */
export function moveRequest(todoListId: number, taskId: number) {
  return { method: 'POST', url: `/api/v1/todo-lists/${todoListId}/tasks/${taskId}/move` };
}

/** An open Task, as the backend adds one. */
export function openTask(id: number, title: string): Task {
  return {
    id,
    title,
    description: null,
    priority: Priority.MEDIUM,
    dueDate: null,
    overdue: false,
    completedAt: null,
    version: 1,
  };
}

export const MILK = openTask(21, 'Buy milk');
export const BREAD = openTask(22, 'Buy bread');
/** Completed at noon on 27 October 2026, in the time zone the tests run in. */
export const EGGS: Task = { ...openTask(23, 'Buy eggs'), completedAt: '2026-10-27T12:00:00Z' };
