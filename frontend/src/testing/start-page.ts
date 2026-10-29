import { HttpTestingController } from '@angular/common/http/testing';
import { answerAppInfo } from './app-info';
import { answerDashboard, DASHBOARD_REQUEST, EMPTY_DASHBOARD } from './dashboard';
import { renderRoute } from './routed-page';

/**
 * Answers what the start page asks for, as every landing on `/` does: the backend's info, and the
 * dashboard, with nothing open. For tests about something else than the start page.
 */
export async function answerStartPage(http: HttpTestingController): Promise<void> {
  await answerAppInfo(http);
  await answerDashboard(http);
}

/**
 * The start page, with its dashboard answered at once, empty: for tests about the backend's info,
 * as the dashboard has tests of its own.
 */
export async function renderStartPage(...args: Parameters<typeof renderRoute>) {
  const page = await renderRoute(...args);
  page.http.expectOne(DASHBOARD_REQUEST).flush(EMPTY_DASHBOARD);
  return page;
}
