import { MatSidenavHarness } from '@angular/material/sidenav/testing';
import { answerAppInfo } from './app-info';
import { Locale } from './locale';
import { renderRoute } from './routed-page';

/** The app shell around the start page, with the start page's own request answered. */
export async function renderShell(options: { locale?: Locale } = {}) {
  const page = await renderRoute('/', options);
  await answerAppInfo(page.http);
  await page.text();
  return { ...page, drawer: () => page.loader.getHarness(MatSidenavHarness) };
}
