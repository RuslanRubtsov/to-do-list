import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TodoList, TodoListRole } from '@api';
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

/** Todo Lists the logged-in User, Olena, owns. */
export const GROCERIES: TodoList = {
  id: 5,
  name: 'Groceries',
  openTaskCount: 3,
  version: 1,
  role: TodoListRole.OWNER,
  ownerDisplayName: 'Olena',
};
export const WORK: TodoList = { ...GROCERIES, id: 8, name: 'Work', openTaskCount: 0 };

/** Todo Lists Taras Shared with Olena: as an Editor, and as a Viewer. */
export const GARDEN: TodoList = {
  id: 11,
  name: 'Garden',
  openTaskCount: 2,
  version: 1,
  role: TodoListRole.EDITOR,
  ownerDisplayName: 'Taras',
};
export const TRIP: TodoList = { ...GARDEN, id: 12, name: 'Trip', role: TodoListRole.VIEWER };

/** Answers as the backend does for a Todo List that doesn't exist or isn't the User's. */
export function failAsNotFound(request: TestRequest): void {
  request.flush(
    { status: 404, title: 'Not Found', code: 'NOT_FOUND' },
    { status: 404, statusText: 'Not Found' },
  );
}

/** Answers as the backend does for a change based on a version someone else has since replaced. */
export function failAsEditConflict(request: TestRequest): void {
  request.flush(
    { status: 409, title: 'Conflict', code: 'EDIT_CONFLICT' },
    { status: 409, statusText: 'Conflict' },
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
