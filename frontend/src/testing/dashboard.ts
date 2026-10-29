import { HttpTestingController } from '@angular/common/http/testing';
import { Dashboard, DashboardTask, Task, TodoList } from '@api';
import { LAZY_ROUTE_WAIT } from './session';

export const DASHBOARD_REQUEST = { method: 'GET', url: '/api/v1/dashboard' };

/** The dashboard of a User with nothing open. */
export const EMPTY_DASHBOARD: Dashboard = {
  counts: { open: 0, overdue: 0, dueToday: 0, completedThisWeek: 0 },
  overdue: [],
  dueToday: [],
  upcoming: [],
};

/** Waits for the start page to ask for the dashboard, and answers with this one. */
export async function answerDashboard(
  http: HttpTestingController,
  dashboard: Dashboard = EMPTY_DASHBOARD,
): Promise<void> {
  const request = await vi.waitFor(() => http.expectOne(DASHBOARD_REQUEST), LAZY_ROUTE_WAIT);
  request.flush(dashboard);
}

/** A Task on the dashboard, with the Todo List it is in. */
export function onDashboard(task: Task, todoList: TodoList): DashboardTask {
  return { task, todoList: { id: todoList.id, name: todoList.name, role: todoList.role } };
}
