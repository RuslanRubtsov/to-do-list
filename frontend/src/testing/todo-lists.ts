import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TodoList } from '@api';
import { LAZY_ROUTE_WAIT } from './session';

export const TODO_LISTS = { method: 'GET', url: '/api/v1/todo-lists' };
export const CREATE_TODO_LIST = { method: 'POST', url: '/api/v1/todo-lists' };

/** A request about one Todo List: reading, renaming or deleting it. */
export function todoListRequest(method: 'GET' | 'PATCH' | 'DELETE', id: number) {
  return { method, url: `/api/v1/todo-lists/${id}` };
}

/**
 * Waits for the app shell's navigation drawer to load the User's Todo Lists, as it does when a
 * User logs in, and answers with `todoLists`.
 */
export async function answerTodoLists(
  http: HttpTestingController,
  todoLists: TodoList[] = [],
): Promise<void> {
  const request = await vi.waitFor(() => http.expectOne(TODO_LISTS), LAZY_ROUTE_WAIT);
  request.flush(todoLists);
}

export const GROCERIES: TodoList = { id: 5, name: 'Groceries', openTaskCount: 3 };
export const WORK: TodoList = { id: 8, name: 'Work', openTaskCount: 0 };

/** Answers as the backend does for a Todo List that doesn't exist or isn't the User's. */
export function failAsNotFound(request: TestRequest): void {
  request.flush(
    { status: 404, title: 'Not Found', code: 'NOT_FOUND' },
    { status: 404, statusText: 'Not Found' },
  );
}

/** Answers as the backend does when the field of the request's body breaks a constraint. */
export function failFieldAsInvalid(request: TestRequest, field: string, code: string): void {
  request.flush(
    {
      status: 400,
      title: 'Bad Request',
      code: 'VALIDATION_FAILED',
      errors: [{ field, code }],
    },
    { status: 400, statusText: 'Bad Request' },
  );
}
