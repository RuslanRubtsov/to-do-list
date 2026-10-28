import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerAppInfo } from '../../testing/app-info';
import { renderRoute } from '../../testing/routed-page';
import { LOGIN, REGISTER, LOGGED_IN } from '../../testing/session';

function validationFailed(...errors: { field: string; code: string }[]) {
  return [
    { status: 400, title: 'Bad Request', code: 'VALIDATION_FAILED', errors },
    { status: 400, statusText: 'Bad Request' },
  ] as const;
}

async function renderRegistration(url = '/register') {
  const page = await renderRoute(url, { session: null });
  return {
    ...page,
    async fillIn(fields: { name?: string; email?: string; password?: string } = {}) {
      await page.fill('Name', fields.name ?? 'Olena');
      await page.fill('Email', fields.email ?? 'olena@example.com');
      await page.fill('Password', fields.password ?? 'correct-horse-7');
    },
  };
}

describe('Registration page', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('registers the User, logs them in and opens the app', async () => {
    const page = await renderRegistration();

    await page.fillIn();
    page.click('Create account');

    const register = page.http.expectOne(REGISTER);
    expect(register.request.body).toEqual({
      displayName: 'Olena',
      email: 'olena@example.com',
      password: 'correct-horse-7',
      preferredLanguage: 'en',
    });
    register.flush(LOGGED_IN.user, { status: 201, statusText: 'Created' });
    const login = page.http.expectOne(LOGIN);
    expect(login.request.body).toEqual({ email: 'olena@example.com', password: 'correct-horse-7' });
    login.flush(LOGGED_IN);
    await answerAppInfo(page.http);

    expect(await page.url()).toBe('/');
    expect(await page.text()).toContain('Olena');
  });

  it('returns to the page that asked for a login', async () => {
    const page = await renderRegistration('/register?returnUrl=%2F%3Fview%3Dbookmarked');

    await page.fillIn();
    page.click('Create account');
    page.http.expectOne(REGISTER).flush(LOGGED_IN.user, { status: 201, statusText: 'Created' });
    page.http.expectOne(LOGIN).flush(LOGGED_IN);
    await answerAppInfo(page.http);

    expect(await page.url()).toBe('/?view=bookmarked');
  });

  it('shows the password rules being met as the User types', async () => {
    const page = await renderRegistration();
    const rulesMet = () => document.querySelectorAll('#password-rules .met').length;
    expect(rulesMet()).toBe(0);

    await page.fill('Password', 'abc');
    expect(rulesMet()).toBe(1);

    await page.fill('Password', 'abc1');
    expect(rulesMet()).toBe(2);

    await page.fill('Password', 'abcdefg1');
    expect(rulesMet()).toBe(3);
  });

  it('enforces the password rules before sending the form', async () => {
    const page = await renderRegistration();

    await page.fillIn({ password: 'no-digits-here' });
    page.click('Create account');

    expect(await page.fieldErrors('Password')).toEqual([
      'Choose a password that follows the rules below.',
    ]);
    page.http.expectNone(REGISTER);
  });

  it('refuses a password too long to hash', async () => {
    const page = await renderRegistration();

    // 41 characters, but 81 bytes: Cyrillic letters take two each
    await page.fillIn({ password: 'ж'.repeat(40) + '7' });
    page.click('Create account');

    expect(await page.fieldErrors('Password')).toEqual(['This password is too long.']);
    page.http.expectNone(REGISTER);
  });

  it('asks for the missing fields', async () => {
    const page = await renderRegistration();

    page.click('Create account');

    expect(await page.fieldErrors('Name')).toEqual(['Enter your name.']);
    expect(await page.fieldErrors('Email')).toEqual(['Enter your email.']);
    expect(await page.fieldErrors('Password')).toEqual(['Choose a password.']);
    page.http.expectNone(REGISTER);
  });

  it('says when the email is already registered', async () => {
    const page = await renderRegistration();

    await page.fillIn();
    page.click('Create account');
    page.http
      .expectOne(REGISTER)
      .flush(
        { status: 409, title: 'Conflict', code: 'EMAIL_TAKEN' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await page.fieldErrors('Email')).toEqual([
      'This email is already registered. Log in instead?',
    ]);
    expect(await page.url()).toBe('/register');
  });

  it('shows the fields the server refused next to them', async () => {
    const page = await renderRegistration();

    await page.fillIn();
    page.click('Create account');
    page.http
      .expectOne(REGISTER)
      .flush(
        ...validationFailed(
          { field: 'email', code: 'EMAIL' },
          { field: 'displayName', code: 'PATTERN' },
        ),
      );

    expect(await page.fieldErrors('Email')).toEqual(['Enter a valid email address.']);
    expect(await page.fieldErrors('Name')).toEqual(['Enter your name.']);
  });

  it('clears a server error once the field is edited', async () => {
    const page = await renderRegistration();
    await page.fillIn();
    page.click('Create account');
    page.http.expectOne(REGISTER).flush(...validationFailed({ field: 'email', code: 'EMAIL' }));

    await page.fill('Email', 'olena@example.org');

    expect(await page.fieldErrors('Email')).toEqual([]);
  });

  it('says so when the server is unreachable', async () => {
    const page = await renderRegistration();

    await page.fillIn();
    page.click('Create account');
    page.http.expectOne(REGISTER).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.text()).toContain("Can't reach the server");
  });

  it('links to logging in, keeping where to return to', async () => {
    const page = await renderRegistration('/register?returnUrl=%2Fsomewhere');

    expect(page.control('Log in').getAttribute('href')).toBe('/login?returnUrl=%2Fsomewhere');
  });
});
