import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { EGGS, MILK, moveRequest } from '../../testing/tasks';
import { renderTodoListPage } from '../../testing/todo-list-page';
import { GARDEN, GROCERIES, TRIP } from '../../testing/todo-lists';

/** What a Todo List's page offers, by the User's role on it. */
describe('Roles on a Todo List', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('offers its Owner renaming, deleting and Sharing it', async () => {
    const page = await renderTodoListPage(GROCERIES, { tasks: [MILK] });

    expect(page.has('Rename Todo List')).toBe(true);
    expect(page.has('Delete Todo List')).toBe(true);
    expect(page.has('Share Todo List')).toBe(true);
    expect(await page.text()).not.toContain('Shared by');
  });

  it('offers an Editor only its Tasks to change, and says who Shared it in what role', async () => {
    const page = await renderTodoListPage(GARDEN, { tasks: [MILK, EGGS] });

    expect(page.has('Rename Todo List')).toBe(false);
    expect(page.has('Delete Todo List')).toBe(false);
    expect(page.has('Share Todo List')).toBe(false);
    expect(await page.text()).toContain('Shared by Taras · Editor');
    expect(await isDisabled(page, 'New Task')).toBe(false);
    expect(await (await page.checkbox('Buy milk')).isDisabled()).toBe(false);
    expect(page.control('Edit “Buy milk”').hasAttribute('disabled')).toBe(false);
    expect(page.control('Delete “Buy milk”').hasAttribute('disabled')).toBe(false);
  });

  it('shows a Viewer every Task editing control disabled', async () => {
    const page = await renderTodoListPage(TRIP, {
      tasks: [MILK, EGGS, { ...MILK, id: 30, title: 'Buy tea' }],
    });

    expect(await page.text()).toContain('Shared by Taras · Viewer');
    expect(page.has('Rename Todo List')).toBe(false);
    expect(page.has('Delete Todo List')).toBe(false);
    expect(page.has('Share Todo List')).toBe(false);
    expect(await isDisabled(page, 'New Task')).toBe(true);
    expect(page.control('Add Task').hasAttribute('disabled')).toBe(true);
    for (const title of ['Buy milk', 'Buy tea']) {
      expect(await (await page.checkbox(title)).isDisabled()).toBe(true);
      expect(page.control(`Edit “${title}”`).hasAttribute('disabled')).toBe(true);
      expect(page.control(`Delete “${title}”`).hasAttribute('disabled')).toBe(true);
    }
    page.click('Completed (1)');
    await page.text();
    expect(await (await page.checkbox('Buy eggs')).isDisabled()).toBe(true);
    expect(page.control('Edit “Buy eggs”').hasAttribute('disabled')).toBe(true);
    expect(page.control('Delete “Buy eggs”').hasAttribute('disabled')).toBe(true);

    await page.drag('Open Tasks', 1, 0);
    expect(page.listItems('Open Tasks')).toEqual(['Buy milk', 'Buy tea']);
    page.http.expectNone(moveRequest(TRIP.id, 30));
  });
});

async function isDisabled(
  page: Awaited<ReturnType<typeof renderTodoListPage>>,
  label: string,
): Promise<boolean> {
  return (
    await page.loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }))
  ).isDisabled();
}
