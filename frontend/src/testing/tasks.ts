import { Priority, Task } from '@api';

/** Listing a Todo List's Tasks, or adding one. */
export function tasksRequest(method: 'GET' | 'POST', todoListId: number) {
  return { method, url: `/api/v1/todo-lists/${todoListId}/tasks` };
}

export function deleteTaskRequest(todoListId: number, taskId: number) {
  return { method: 'DELETE', url: `/api/v1/todo-lists/${todoListId}/tasks/${taskId}` };
}

/** `PUT` completes the Task, `DELETE` un-completes it. */
export function completionRequest(method: 'PUT' | 'DELETE', todoListId: number, taskId: number) {
  return { method, url: `/api/v1/todo-lists/${todoListId}/tasks/${taskId}/completion` };
}

/** An open Task, as the backend adds one. */
export function openTask(id: number, title: string): Task {
  return { id, title, priority: Priority.MEDIUM, dueDate: null, completedAt: null };
}

export const MILK = openTask(21, 'Buy milk');
export const BREAD = openTask(22, 'Buy bread');
/** Completed at noon on 27 October 2026, in the time zone the tests run in. */
export const EGGS: Task = { ...openTask(23, 'Buy eggs'), completedAt: '2026-10-27T12:00:00Z' };
