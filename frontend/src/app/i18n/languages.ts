import { DOCUMENT } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Language } from '@api';

/** Each language's name in that language, as a switcher offers it. Not translated. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  [Language.en]: 'English',
  [Language.uk]: 'Українська',
};

/** Loads a page in full, leaving the running app. */
@Injectable({ providedIn: 'root' })
export class PageLoader {
  private readonly location = inject(DOCUMENT).location;

  load(url: string): void {
    this.location.assign(url);
  }
}

/**
 * The language this build of the app is in, and the way to the others. Each language is a
 * separate build served under its own path, `/en/` or `/uk/` (ADR-0002), so changing language
 * means loading the page again from the other build.
 */
@Injectable({ providedIn: 'root' })
export class Languages {
  private readonly pageLoader = inject(PageLoader);

  readonly current: Language = inject(LOCALE_ID).startsWith('uk') ? Language.uk : Language.en;
  readonly others: Language[] = Object.values(Language).filter((l) => l !== this.current);

  /** Opens `path`, an app URL such as the router's, in the build for `language`. */
  open(language: Language, path: string): void {
    this.pageLoader.load(`/${language}${path}`);
  }
}
