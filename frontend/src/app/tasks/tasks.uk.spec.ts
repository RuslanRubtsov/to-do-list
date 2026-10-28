import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EGGS, MILK } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { GROCERIES } from '../../testing/todo-lists';

/** Locale smoke test: a Todo List's Tasks, and when they were Completed, in Ukrainian. */
describe('Tasks in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('says when a Task was Completed in Ukrainian date and time formats', async () => {
    const page = await renderTodoListPage(GROCERIES, { locale: 'uk', tasks: [MILK, EGGS] });

    expect(page.listItems('Невиконані завдання')).toEqual(['Buy milk']);
    page.click('Виконані (1)');

    await page.text();
    expect(page.listItems('Виконані (1)')).toEqual(['Buy eggs Виконано 27 жовт. 2026 р. о 14:00']);
  });
});
