import { MatSidenavHarness } from '@angular/material/sidenav/testing';
import { Locale } from './locale';
import { renderRoute } from './routed-page';

/** The app shell around the start page, with the start page's own request answered. */
export async function renderShell(options: { locale?: Locale } = {}) {
  const page = await renderRoute('/', options);
  page.http
    .expectOne('/api/v1/app-info')
    .flush({ name: 'todo-backend', version: '1.4.2', buildTime: new Date().toISOString() });
  await page.text();
  return { ...page, drawer: () => page.loader.getHarness(MatSidenavHarness) };
}
