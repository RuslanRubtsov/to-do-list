import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { renderRoute } from '../../testing/routed-page';
import { REGISTER } from '../../testing/session';

/** Locale smoke test: the registration form, its field errors and rules, in Ukrainian. */
describe('Registration page in Ukrainian', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows translated field errors', async () => {
    const page = await renderRoute('/register', { locale: 'uk', session: null });

    page.click('Створити обліковий запис');

    expect(await page.fieldErrors('Ім’я')).toEqual(['Введіть ім’я.']);
    expect(await page.fieldErrors('Електронна пошта')).toEqual(['Введіть електронну пошту.']);
    expect(await page.fieldErrors('Пароль')).toEqual(['Придумайте пароль.']);
    expect(await page.text()).toContain('Щонайменше 8 символів');
  });

  it('translates the error codes the server answers with', async () => {
    const page = await renderRoute('/register', { locale: 'uk', session: null });
    await page.fill('Ім’я', 'Олена');
    await page.fill('Електронна пошта', 'olena@example.com');
    await page.fill('Пароль', 'пароль-сім-7');

    page.click('Створити обліковий запис');
    page.http
      .expectOne(REGISTER)
      .flush(
        { status: 409, title: 'Conflict', code: 'EMAIL_TAKEN' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await page.fieldErrors('Електронна пошта')).toEqual([
      'Ця електронна пошта вже зареєстрована. Може, увійти?',
    ]);
  });

  it('registers the User in Ukrainian as their preferred language', async () => {
    const page = await renderRoute('/register', { locale: 'uk', session: null });
    await page.fill('Ім’я', 'Олена');
    await page.fill('Електронна пошта', 'olena@example.com');
    await page.fill('Пароль', 'пароль-сім-7');

    page.click('Створити обліковий запис');

    const register = page.http.expectOne(REGISTER);
    expect(register.request.body.preferredLanguage).toBe('uk');
    register.flush(
      { status: 500, title: 'Internal Server Error', code: 'INTERNAL_ERROR' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });
});
