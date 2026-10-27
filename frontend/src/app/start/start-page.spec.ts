import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppInfo } from '@api';
import { renderRoute } from '../../testing/routed-page';

const APP_INFO_REQUEST = { method: 'GET', url: '/api/v1/app-info' };
const APP_INFO: AppInfo = { name: 'todo-backend', version: '1.4.2' };
const UNREACHABLE = "Can't reach the server";

function failAsUnreachable(http: HttpTestingController) {
  http.expectOne(APP_INFO_REQUEST).error(new ProgressEvent('error'), { status: 0 });
}

describe('Start page', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows the backend name and version', async () => {
    const page = await renderRoute('/');

    page.http.expectOne(APP_INFO_REQUEST).flush(APP_INFO);

    const text = await page.text();
    expect(text).toContain('todo-backend');
    expect(text).toContain('1.4.2');
  });

  it('shows an error when the backend is unreachable', async () => {
    const page = await renderRoute('/');

    failAsUnreachable(page.http);

    expect(await page.text()).toContain(UNREACHABLE);
  });

  it('treats a gateway error from the reverse proxy as an unreachable backend', async () => {
    const page = await renderRoute('/');

    page.http
      .expectOne(APP_INFO_REQUEST)
      .flush('<html>502 Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(await page.text()).toContain(UNREACHABLE);
  });

  it('tells a server failure apart from an unreachable backend', async () => {
    const page = await renderRoute('/');

    page.http
      .expectOne(APP_INFO_REQUEST)
      .flush(
        { status: 500, code: 'INTERNAL_ERROR' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    const text = await page.text();
    expect(text).toContain('The server ran into a problem');
    expect(text).not.toContain(UNREACHABLE);
  });

  it('loads the app info again when retrying after an error', async () => {
    const page = await renderRoute('/');
    failAsUnreachable(page.http);
    await page.text();

    page.click('Retry');
    page.http.expectOne(APP_INFO_REQUEST).flush(APP_INFO);

    const text = await page.text();
    expect(text).toContain('1.4.2');
    expect(text).not.toContain(UNREACHABLE);
  });
});
