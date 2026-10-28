import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerAppInfo } from '../../testing/app-info';
import { DESKTOP, emulateMedia } from '../../testing/media';
import { renderRoute } from '../../testing/routed-page';
import { CREATE_TODO_LIST, failNameAsInvalid } from '../../testing/todo-lists';

/** Locale smoke test: the drawer's Todo Lists and the naming dialog, in Ukrainian. */
describe('Todo Lists in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function renderStart(openTaskCounts: number[]) {
    emulateMedia(DESKTOP);
    const todoLists = openTaskCounts.map((openTaskCount, i) => ({
      id: i + 1,
      name: `Список ${i + 1}`,
      openTaskCount,
    }));
    const page = await renderRoute('/', { locale: 'uk', todoLists });
    await answerAppInfo(page.http);
    await page.text();
    return page;
  }

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
    failNameAsInvalid(page.http.expectOne(CREATE_TODO_LIST), 'SIZE');
    expect(await page.fieldErrors('Назва')).toEqual(['Не більше ніж 100 символів.']);
  });
});
