import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession, Language, TodoList } from '@api';
import { appConfig } from '../app/app.config';
import { PageLoader } from '../app/i18n/languages';
import { Locale, useLocale } from './locale';
import { FakePageLoader } from './page-loads';
import { answerSessionRefresh, LOGGED_IN } from './session';
import { TODO_LISTS } from './todo-lists';

/**
 * Renders a real routed page with the real app configuration, faking only the HTTP backend
 * beneath the generated API client. Renders in the source locale (English) unless told otherwise.
 *
 * Like a page load, the first navigation restores the session from the refresh token cookie:
 * `session` is what that answers, `null` for a visitor. Unless told otherwise, it is a logged-in
 * User who prefers the language being rendered, as a User of that build normally would.
 *
 * The app shell's navigation drawer loads the User's Todo Lists: `todoLists` is what that
 * answers, none unless told otherwise.
 */
export async function renderRoute(
  url: string,
  options: { locale?: Locale; session?: AuthSession | null; todoLists?: TodoList[] } = {},
) {
  const locale = options.locale ?? 'en';
  useLocale(locale);
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      { provide: LOCALE_ID, useValue: locale },
      { provide: PageLoader, useClass: FakePageLoader },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigation = harness.navigateByUrl(url);
  await answerSessionRefresh(
    http,
    options.session === undefined ? loggedInIn(locale) : options.session,
  );
  await navigation;
  TestBed.tick();
  for (const request of http.match(TODO_LISTS)) request.flush(options.todoLists ?? []);
  TestBed.tick();

  const root = () => harness.routeNativeElement ?? document.createElement('div');
  /**
   * Buttons and links: what a person can activate. Also those in overlays outside the routed
   * page, such as dialogs and snack bars.
   */
  const controls = () => Array.from(document.body.querySelectorAll<HTMLElement>('button, a'));
  const findControl = (label: string) =>
    controls().find((control) => accessibleName(control) === label);
  const control = (label: string): HTMLElement => {
    const found = findControl(label);
    if (!found) {
      const names = controls().map(accessibleName).join('", "');
      throw new Error(`No button or link labelled "${label}" (found "${names}")`);
    }
    return found;
  };
  const loader = TestbedHarnessEnvironment.loader(harness.fixture);
  /** Also finds components in overlays, such as the form fields of a dialog. */
  const documentLoader = TestbedHarnessEnvironment.documentRootLoader(harness.fixture);
  /** The select of the form field with this label. */
  const selectIn = async (label: string): Promise<MatSelectHarness> => {
    const field = await documentLoader.getHarness(
      MatFormFieldHarness.with({ floatingLabelText: label }),
    );
    const select = await field.getControl(MatSelectHarness);
    if (!select) throw new Error(`The "${label}" field has no select`);
    return select;
  };

  return {
    http,
    /** Material's test harnesses, for asking real components about their state. */
    loader,
    /** Lets the page react to flushed responses, then returns its rendered text. */
    async text(): Promise<string> {
      await harness.fixture.whenStable();
      return root().textContent ?? '';
    },
    /** What the alerts on the page and in its overlays, such as dialogs, say. */
    async alerts(): Promise<string[]> {
      await harness.fixture.whenStable();
      return Array.from(document.body.querySelectorAll<HTMLElement>('[role="alert"]'), readAloud);
    },
    /** The text of the app shell's toolbar, apart from the page below it. */
    toolbarText(): string {
      return root().querySelector('mat-toolbar')?.textContent ?? '';
    },
    /** The text of the page's main heading. */
    heading(): string {
      return root().querySelector('h1')?.textContent?.trim() ?? '';
    },
    /** The URL the app is showing, once it has settled. */
    async url(): Promise<string> {
      await harness.fixture.whenStable();
      return router.url;
    },
    /** The full page loads the app made, leaving itself: switching to another locale build. */
    pageLoads(): string[] {
      return (TestBed.inject(PageLoader) as FakePageLoader).loaded;
    },
    /** Whether a button or link with this accessible name is on the page. */
    has(label: string): boolean {
      return findControl(label) !== undefined;
    },
    /** The button or link with this accessible name, for checking its ARIA state. */
    control,
    /** The checkbox with this label, for checking and changing its state. */
    checkbox(label: string): Promise<MatCheckboxHarness> {
      return loader.getHarness(MatCheckboxHarness.with({ label }));
    },
    /**
     * What each item of the list labelled by this heading says, as a screen reader reads it;
     * `undefined` when there is no such list.
     */
    listItems(label: string): string[] | undefined {
      const list = Array.from(root().querySelectorAll<HTMLElement>('ul[aria-labelledby]')).find(
        (candidate) => {
          const heading = document.getElementById(candidate.getAttribute('aria-labelledby') ?? '');
          return heading !== null && accessibleName(heading) === label;
        },
      );
      return list ? Array.from(list.children, (item) => readAloud(item as HTMLElement)) : undefined;
    },
    /** The navigation landmark with this accessible name, if there is one. */
    navigation(label: string): HTMLElement | undefined {
      return Array.from(root().querySelectorAll<HTMLElement>('nav, [role="navigation"]')).find(
        (landmark) => accessibleName(landmark) === label,
      );
    },
    /**
     * Clicks the button or link with this accessible name and lets the page start reacting.
     * Doesn't wait for it to settle: a click may start a request the test has yet to answer.
     */
    click(label: string): void {
      control(label).click();
      TestBed.tick();
    },
    /** Types into the form field with this label, replacing what it held. */
    async fill(label: string, value: string): Promise<void> {
      const field = await documentLoader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: label }),
      );
      const input = await field.getControl(MatInputHarness);
      if (!input) throw new Error(`The "${label}" field has no text input`);
      await input.setValue(value);
    },
    /** Chooses the option with this text in the select of the form field with this label. */
    async choose(label: string, option: string): Promise<void> {
      const select = await selectIn(label);
      await select.open();
      await select.clickOptions({ text: option });
    },
    /** The text of the option chosen in the select of the form field with this label. */
    async chosen(label: string): Promise<string> {
      return (await selectIn(label)).getValueText();
    },
    /** What the form field with this label holds. */
    async fieldValue(label: string): Promise<string> {
      const field = await documentLoader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: label }),
      );
      const input = await field.getControl(MatInputHarness);
      if (!input) throw new Error(`The "${label}" field has no text input`);
      return input.getValue();
    },
    /** The error messages the form field with this label shows. */
    async fieldErrors(label: string): Promise<string[]> {
      await harness.fixture.whenStable();
      const field = await documentLoader.getHarness(
        MatFormFieldHarness.with({ floatingLabelText: label }),
      );
      return field.getTextErrors();
    },
  };
}

/** The text of the snack bar, which opens in an overlay outside the routed page. */
export function snackBarText(): string {
  return document.querySelector('mat-snack-bar-container')?.textContent ?? '';
}

/** The text a screen reader reads out of an element, piece by piece, as one line. */
function readAloud(element: HTMLElement): string {
  const visible = element.cloneNode(true) as HTMLElement;
  visible.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  const walker = document.createTreeWalker(visible, NodeFilter.SHOW_TEXT);
  const pieces: string[] = [];
  while (walker.nextNode()) pieces.push(walker.currentNode.textContent ?? '');
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

/** What a screen reader announces: the aria-label, or else the text it doesn't hide. */
function accessibleName(element: HTMLElement): string {
  const label = element.getAttribute('aria-label');
  if (label !== null) return label.trim();
  const visible = element.cloneNode(true) as HTMLElement;
  visible.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return (visible.textContent ?? '').trim();
}

/** {@link LOGGED_IN}, preferring the language of the build being rendered. */
function loggedInIn(locale: Locale): AuthSession {
  const language = { en: Language.en, uk: Language.uk }[locale];
  return { ...LOGGED_IN, user: { ...LOGGED_IN.user, preferredLanguage: language } };
}
