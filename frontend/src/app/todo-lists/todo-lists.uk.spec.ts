import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerAppInfo } from '../../testing/app-info';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { renderTodoListPage } from '../../testing/todo-list-page';
import {
  CREATE_TODO_LIST,
  failFieldAsInvalid,
  GARDEN,
  GROCERIES,
  TRIP,
} from '../../testing/todo-lists';

/** Locale smoke test: the drawer's Todo Lists and the naming dialog, in Ukrainian. */
describe('Todo Lists in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function renderStart(openTaskCounts: number[]) {
    emulateMedia(DESKTOP);
    const todoLists = openTaskCounts.map((openTaskCount, i) => ({
      ...GROCERIES,
      id: i + 1,
      name: `Список ${i + 1}`,
      openTaskCount,
    }));
    const page = await renderRoute('/', { locale: 'uk', todoLists });
    await answerAppInfo(page.http);
    await page.text();
    return page;
  }

  it('says in Ukrainian who owns a Shared Todo List, and the User’s role on it', async () => {
    const page = await renderTodoListPage(TRIP, { locale: 'uk', others: [GARDEN] });

    expect(page.has('Garden, 2 невиконані завдання, Taras · Редактор')).toBe(true);
    expect(await page.text()).toContain('Власник: Taras · Читач');
    expect(await page.text()).toContain('Доступні мені');
  });

  it('asks in Ukrainian before leaving a Shared Todo List', async () => {
    const page = await renderTodoListPage(GARDEN, { locale: 'uk' });

    page.click('Вийти зі списку справ');
    await page.text();

    expect(document.body.textContent).toContain('Вийти зі списку «Garden»?');
    expect(document.body.textContent).toContain(
      'Ви більше не бачитимете його та його завдань, доки Taras знову не надасть вам доступ.',
    );
    page.click('Скасувати');
  });

  it('counts open Tasks with the Ukrainian plural forms', async () => {
    const page = await renderStart([0, 1, 3, 5, 21]);

    expect(page.has('Список 1, немає невиконаних завдань')).toBe(true);
    expect(page.has('Список 2, 1 невиконане завдання')).toBe(true);
    expect(page.has('Список 3, 3 невиконані завдання')).toBe(true);
    expect(page.has('Список 4, 5 невиконаних завдань')).toBe(true);
    expect(page.has('Список 5, 21 невиконане завдання')).toBe(true);
  });

  it('explains what is wrong with a name in Ukrainian', async () => {
    const page = await renderStart([]);

    page.click('Новий список справ');
    await page.fill('Назва', ' ');
    page.click('Створити');
    expect(await page.fieldErrors('Назва')).toEqual(['Введіть назву.']);

    await page.fill('Назва', 'Покупки');
    page.click('Створити');
    failFieldAsInvalid(page.http.expectOne(CREATE_TODO_LIST), 'name', 'SIZE');
    expect(await page.fieldErrors('Назва')).toEqual(['Не більше ніж 100 символів.']);
  });
});
