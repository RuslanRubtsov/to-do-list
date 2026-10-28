import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Priority } from '@api';
import { MILK, openTask, taskRequest } from '../../testing/tasks';
import { openDetails, renderTodoListPage } from '../../testing/todo-list-page';
import { failAsEditConflict, GROCERIES } from '../../testing/todo-lists';

// The first test renders lazy routes, a dialog, a date picker and a select cold
vi.setConfig({ testTimeout: 30_000 });

/** Locale smoke test: a Task's Due Date and Priority, written and read in Ukrainian. */
describe('Task details in Ukrainian', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  /** On Wednesday 28 October 2026; only the date is faked. */
  function renderOn(tasks = [MILK]) {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T10:00:00Z') });
    return renderTodoListPage(GROCERIES, { locale: 'uk', tasks });
  }

  it('reads a Due Date written day first, and shows it relative to today', async () => {
    const page = await renderOn();

    await openDetails(page, 'Редагувати «Buy milk»');
    await page.fill('Термін', '29.10.2026');
    await page.choose('Пріоритет', 'Високий');
    page.click('Зберегти');
    const update = page.http.expectOne(taskRequest('PUT', 5, MILK.id));
    expect(update.request.body).toMatchObject({ dueDate: '2026-10-29', priority: Priority.HIGH });
    update.flush({ ...MILK, dueDate: '2026-10-29', priority: Priority.HIGH });

    await vi.waitFor(() =>
      expect(page.listItems('Невиконані завдання')).toEqual([
        'Buy milk Високий пріоритет Термін: завтра',
      ]),
    );
  });

  it('gives an example of a date written the Ukrainian way', async () => {
    const page = await renderOn();

    await openDetails(page, 'Редагувати «Buy milk»');
    await page.fill('Термін', 'скоро');
    page.click('Зберегти');

    expect(await page.fieldErrors('Термін')).toEqual(['Введіть дату, наприклад 31.12.2026.']);
  });

  it('says in Ukrainian that someone else changed the Task meanwhile', async () => {
    const page = await renderOn();

    await openDetails(page, 'Редагувати «Buy milk»');
    await page.fill('Назва', 'Buy oat milk');
    page.click('Зберегти');
    failAsEditConflict(page.http.expectOne(taskRequest('PUT', 5, MILK.id)));
    page.http.expectOne(taskRequest('GET', 5, MILK.id)).flush({ ...MILK, version: 2 });

    expect(await page.alerts()).toEqual([
      'Хтось інший змінив це завдання, поки ви його редагували. Ось яким його залишили: внесіть свої зміни ще раз і збережіть.',
    ]);
  });

  it('shows Overdue Tasks and farther Due Dates in Ukrainian', async () => {
    const page = await renderOn([
      { ...openTask(31, 'Late'), dueDate: '2026-10-27', overdue: true },
      { ...openTask(32, 'Later'), dueDate: '2026-11-03' },
    ]);

    expect(page.listItems('Невиконані завдання')).toEqual([
      'Late Прострочено Термін: учора',
      'Later Термін: 3 лист. 2026 р.',
    ]);
  });
});
