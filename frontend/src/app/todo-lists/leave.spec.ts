import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerStartPage } from '../../testing/start-page';
import { snackBarText } from '../../testing/routed-page';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { GARDEN, GROCERIES } from '../../testing/todo-lists';

const LEAVE = { method: 'DELETE', url: `/api/v1/todo-lists/${GARDEN.id}/shares/me` };

describe('Leaving a Todo List', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('isn’t offered to its Owner', async () => {
    const page = await renderTodoListPage(GROCERIES);

    expect(page.has('Leave Todo List')).toBe(false);
  });

  it('leaves one Shared with the User, once confirmed, for the start page', async () => {
    const page = await renderTodoListPage(GARDEN, { others: [GROCERIES] });

    page.click('Leave Todo List');
    await page.text();
    expect(document.body.textContent).toContain(
      'You’ll no longer see it or its Tasks, unless Taras Shares it with you again.',
    );
    page.click('Leave');
    await vi
      .waitFor(() => page.http.expectOne(LEAVE))
      .then((request) => request.flush(null, { status: 204, statusText: 'No Content' }));
    await answerStartPage(page.http);

    expect(await page.url()).toBe('/');
    expect(page.has('Garden, no open Tasks, Taras · Editor')).toBe(false);
    expect(page.has('Groceries, 3 open Tasks')).toBe(true);
    expect(snackBarText()).toContain('You left “Garden”.');
  });

  it('stays when cancelled', async () => {
    const page = await renderTodoListPage(GARDEN);

    page.click('Leave Todo List');
    await page.text();
    page.click('Cancel');

    expect(await page.url()).toBe('/lists/11');
    page.http.expectNone(LEAVE);
  });

  it('stays, and says so, when leaving fails', async () => {
    const page = await renderTodoListPage(GARDEN);

    page.click('Leave Todo List');
    await page.text();
    page.click('Leave');
    await vi
      .waitFor(() => page.http.expectOne(LEAVE))
      .then((request) => request.error(new ProgressEvent('error'), { status: 0 }));

    expect(await page.url()).toBe('/lists/11');
    expect(page.has('Garden, no open Tasks, Taras · Editor')).toBe(true);
    expect(snackBarText()).toContain(
      'Couldn’t leave “Garden”. Check your connection and try again.',
    );
  });
});
