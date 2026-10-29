import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { snackBarText } from '../../testing/routed-page';
import { BREAD, EGGS, MILK, moveRequest, openTask } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { GROCERIES } from '../../testing/todo-lists';

const BUTTER = openTask(24, 'Buy butter');

describe('Task order', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('moves a Task up by dragging it, placing it before the one it was dropped on', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD, BUTTER] });

    await page.drag('Open Tasks', 2, 0);

    expect(page.listItems('Open Tasks')).toEqual(['Buy butter', 'Buy milk', 'Buy bread']);
    const move = page.http.expectOne(moveRequest(5, BUTTER.id));
    expect(move.request.body).toEqual({ placement: 'BEFORE', relativeTo: MILK.id });
    move.flush(BUTTER);
    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy butter', 'Buy milk', 'Buy bread']);
  });

  it('moves a Task down, placing it after the one it was dropped on', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD, BUTTER] });

    await page.drag('Open Tasks', 0, 1);

    expect(page.listItems('Open Tasks')).toEqual(['Buy bread', 'Buy milk', 'Buy butter']);
    const move = page.http.expectOne(moveRequest(5, MILK.id));
    expect(move.request.body).toEqual({ placement: 'AFTER', relativeTo: BREAD.id });
    move.flush(MILK);
  });

  it('moves open Tasks past Completed ones, which keep their place', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, EGGS, BREAD] });

    await page.drag('Open Tasks', 1, 0);

    const move = page.http.expectOne(moveRequest(5, BREAD.id));
    expect(move.request.body).toEqual({ placement: 'BEFORE', relativeTo: MILK.id });
    move.flush(BREAD);
    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy bread', 'Buy milk']);
  });

  it('puts the Task back, and says so, when the move fails', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK, BREAD, BUTTER] });

    await page.drag('Open Tasks', 2, 0);
    page.http.expectOne(moveRequest(5, BUTTER.id)).error(new ProgressEvent('error'), { status: 0 });

    await page.text();
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy bread', 'Buy butter']);
    expect(snackBarText()).toContain(
      'Couldn’t move “Buy butter”. Check your connection and try again.',
    );
  });
});
