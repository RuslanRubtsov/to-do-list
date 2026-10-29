import { ParamMap, Params } from '@angular/router';
import { Priority, TaskSort } from '@api';

/**
 * How the User is viewing a Todo List's Tasks: which ones, in what order, and which page. Kept in
 * the URL, so that reloading or bookmarking the page keeps the view.
 */
export interface TaskView {
  /** Only open or only Completed Tasks; both, the open ones first, when left out. */
  show?: 'open' | 'completed';
  /** Only Tasks of any of these Priorities; any when empty. */
  priorities: Priority[];
  /** Only Tasks due on or after this date, `2026-11-03`. */
  dueFrom?: string;
  /** Only Tasks due on or before this date. */
  dueTo?: string;
  overdueOnly: boolean;
  sort: TaskSort;
  /** Only Tasks with this text in their title or description; any when empty. */
  search: string;
  /** Which page of the Tasks shown first, counting from 0. */
  page: number;
}

/** Every Task, in the manual order, from the first page. */
export const DEFAULT_VIEW: TaskView = {
  priorities: [],
  overdueOnly: false,
  sort: TaskSort.POSITION,
  search: '',
  page: 0,
};

const PRIORITIES = new Set<string>(Object.values(Priority));
const SORTS = new Set<string>(Object.values(TaskSort));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The view a URL's query parameters describe, ignoring any that make no sense. */
export function viewFrom(params: ParamMap): TaskView {
  const show = params.get('show');
  const sort = params.get('sort') ?? '';
  const page = Number(params.get('page'));
  const date = (name: string) => {
    const value = params.get(name);
    return value && DATE.test(value) ? value : undefined;
  };
  return {
    show: show === 'open' || show === 'completed' ? show : undefined,
    priorities: params.getAll('priority').filter((p): p is Priority => PRIORITIES.has(p)),
    dueFrom: date('dueFrom'),
    dueTo: date('dueTo'),
    overdueOnly: params.get('overdue') === 'true',
    sort: SORTS.has(sort) ? (sort as TaskSort) : TaskSort.POSITION,
    search: params.get('q') ?? '',
    // Counting from 1 in the URL, as people do
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
}

/** The query parameters for a view: only those that differ from the default view. */
export function queryParamsOf(view: TaskView): Params {
  return {
    show: view.show,
    priority: view.priorities.length ? view.priorities : undefined,
    dueFrom: view.dueFrom,
    dueTo: view.dueTo,
    overdue: view.overdueOnly ? 'true' : undefined,
    sort: view.sort === TaskSort.POSITION ? undefined : view.sort,
    q: view.search || undefined,
    page: view.page ? view.page + 1 : undefined,
  };
}

/** Whether any filter, sort or search is active: anything but the page differs from the default. */
export function isFiltered(view: TaskView): boolean {
  return (
    view.show !== undefined ||
    view.priorities.length > 0 ||
    view.dueFrom !== undefined ||
    view.dueTo !== undefined ||
    view.overdueOnly ||
    view.sort !== TaskSort.POSITION ||
    view.search !== ''
  );
}

/** Whether the view shows every open Task, so that how many it shows is how many are open. */
export function showsAllOpen(view: TaskView): boolean {
  return (
    isFiltered({ ...view, show: undefined, sort: TaskSort.POSITION }) === false &&
    view.show !== 'completed'
  );
}

/** Whether two views are the same, apart from the page. */
export function sameFilters(a: TaskView, b: TaskView): boolean {
  return JSON.stringify({ ...a, page: 0 }) === JSON.stringify({ ...b, page: 0 });
}
