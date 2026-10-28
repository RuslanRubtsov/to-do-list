import { HttpTestingController } from '@angular/common/http/testing';
import { AppInfo } from '@api';
import { LAZY_ROUTE_WAIT } from './session';

export const APP_INFO_REQUEST = { method: 'GET', url: '/api/v1/app-info' };
export const APP_INFO: AppInfo = {
  name: 'todo-backend',
  version: '1.4.2',
  buildTime: '2026-10-22T09:00:00Z',
};

/**
 * Waits for the start page's own request, which every landing on `/` makes, and answers it. For
 * tests about something else than the start page.
 */
export async function answerAppInfo(http: HttpTestingController): Promise<void> {
  const request = await vi.waitFor(() => http.expectOne(APP_INFO_REQUEST), LAZY_ROUTE_WAIT);
  request.flush(APP_INFO);
}
