import { PageLoader } from '../app/i18n/languages';

/**
 * Stands in for full page loads, which leave the app and which jsdom can't perform. Records the
 * URLs instead, for tests to check where the app went.
 */
export class FakePageLoader extends PageLoader {
  readonly loaded: string[] = [];

  override load(url: string): void {
    this.loaded.push(url);
  }
}
