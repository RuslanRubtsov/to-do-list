import { MatSidenavHarness } from '@angular/material/sidenav/testing';
import { answerStartPage } from './start-page';
import { Locale } from './locale';
import { renderRoute } from './routed-page';

/** The app shell around the start page, with the start page's own request answered. */
export async function renderShell(options: { locale?: Locale } = {}) {
  const page = await renderRoute('/', options);
  await answerStartPage(page.http);
  await page.text();
  return { ...page, drawer: () => page.loader.getHarness(MatSidenavHarness) };
}
