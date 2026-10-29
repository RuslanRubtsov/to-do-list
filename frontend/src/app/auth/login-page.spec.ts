import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { answerStartPage } from '../../testing/start-page';
import { renderRoute } from '../../testing/routed-page';
import { LOGIN, LOGGED_IN } from '../../testing/session';
import { answerTodoLists } from '../../testing/todo-lists';

async function renderLoginAsVisitor(url = '/login') {
  return renderRoute(url, { session: null });
}

describe('Login page', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('logs in with email and password and opens the app', async () => {
    const page = await renderLoginAsVisitor();

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'correct-horse-7');
    page.click('Log in');

    const login = page.http.expectOne(LOGIN);
    expect(login.request.body).toEqual({ email: 'olena@example.com', password: 'correct-horse-7' });
    login.flush(LOGGED_IN);
    await answerStartPage(page.http);
    await answerTodoLists(page.http);

    expect(await page.url()).toBe('/');
    expect(await page.text()).toContain('Olena');
  });

  it('returns to the page that asked for a login', async () => {
    const page = await renderLoginAsVisitor('/?view=bookmarked');
    expect(await page.url()).toBe('/login?returnUrl=%2F%3Fview%3Dbookmarked');

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'correct-horse-7');
    page.click('Log in');
    page.http.expectOne(LOGIN).flush(LOGGED_IN);
    await answerStartPage(page.http);
    await answerTodoLists(page.http);

    expect(await page.url()).toBe('/?view=bookmarked');
    expect(page.pageLoads()).toEqual([]);
  });

  it("opens the app in the User's preferred language when this build is another one", async () => {
    const page = await renderLoginAsVisitor('/?view=bookmarked');

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'correct-horse-7');
    page.click('Log in');
    page.http
      .expectOne(LOGIN)
      .flush({ ...LOGGED_IN, user: { ...LOGGED_IN.user, preferredLanguage: 'uk' } });

    // The Ukrainian build loads the requested page itself; this one goes nowhere
    await vi.waitFor(() => expect(page.pageLoads()).toEqual(['/uk/?view=bookmarked']));
    expect(await page.url()).toMatch(/^\/login/);
  });

  it('never returns to another site', async () => {
    const page = await renderLoginAsVisitor('/login?returnUrl=%2F%2Fevil.example');

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'correct-horse-7');
    page.click('Log in');
    page.http.expectOne(LOGIN).flush(LOGGED_IN);
    await answerStartPage(page.http);
    await answerTodoLists(page.http);

    expect(await page.url()).toBe('/');
  });

  it('says the email or password is wrong without saying which', async () => {
    const page = await renderLoginAsVisitor();

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'wrong-password-1');
    page.click('Log in');
    page.http
      .expectOne(LOGIN)
      .flush(
        { status: 401, title: 'Unauthorized', code: 'INVALID_CREDENTIALS' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(await page.text()).toContain('Wrong email or password.');
    expect(await page.url()).toBe('/login');
  });

  it('says so when the server is unreachable', async () => {
    const page = await renderLoginAsVisitor();

    await page.fill('Email', 'olena@example.com');
    await page.fill('Password', 'correct-horse-7');
    page.click('Log in');
    page.http.expectOne(LOGIN).error(new ProgressEvent('error'), { status: 0 });

    expect(await page.text()).toContain("Can't reach the server");
  });

  it('asks for the missing fields instead of sending the form', async () => {
    const page = await renderLoginAsVisitor();

    page.click('Log in');

    expect(await page.fieldErrors('Email')).toEqual(['Enter your email.']);
    expect(await page.fieldErrors('Password')).toEqual(['Enter your password.']);
    page.http.expectNone(LOGIN);
  });

  it('links to registration, keeping where to return to', async () => {
    const page = await renderLoginAsVisitor('/login?returnUrl=%2Fsomewhere');

    expect(page.control('Create an account').getAttribute('href')).toBe(
      '/register?returnUrl=%2Fsomewhere',
    );
  });

  it('sends a User who is already logged in to the app', async () => {
    const page = await renderRoute('/login');
    await answerStartPage(page.http);

    expect(await page.url()).toBe('/');
  });
});
