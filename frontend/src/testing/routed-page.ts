import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '@api';
import { appConfig } from '../app/app.config';
import { Locale, useLocale } from './locale';
import { answerSessionRefresh, LOGGED_IN } from './session';

/**
 * Renders a real routed page with the real app configuration, faking only the HTTP backend
 * beneath the generated API client. Renders in the source locale (English) unless told otherwise.
 *
 * Like a page load, the first navigation restores the session from the refresh token cookie:
 * `session` is what that answers, a logged-in User unless told otherwise, `null` for a visitor.
 */
export async function renderRoute(
  url: string,
  options: { locale?: Locale; session?: AuthSession | null } = {},
) {
  const locale = options.locale ?? 'en';
  useLocale(locale);
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigation = harness.navigateByUrl(url);
  await answerSessionRefresh(http, options.session === undefined ? LOGGED_IN : options.session);
  await navigation;
  TestBed.tick();

  const root = () => harness.routeNativeElement ?? document.createElement('div');
  /** Buttons and links: what a person can activate. */
  const controls = () => Array.from(root().querySelectorAll<HTMLElement>('button, a'));
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

  return {
    http,
    /** Material's test harnesses, for asking real components about their state. */
    loader,
    /** Lets the page react to flushed responses, then returns its rendered text. */
    async text(): Promise<string> {
      await harness.fixture.whenStable();
      return root().textContent ?? '';
    },
    /** The URL the app is showing, once it has settled. */
    async url(): Promise<string> {
      await harness.fixture.whenStable();
      return router.url;
    },
    /** Whether a button or link with this accessible name is on the page. */
    has(label: string): boolean {
      return findControl(label) !== undefined;
    },
    /** The button or link with this accessible name, for checking its ARIA state. */
    control,
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
      const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
      const input = await field.getControl(MatInputHarness);
      if (!input) throw new Error(`The "${label}" field has no text input`);
      await input.setValue(value);
    },
    /** The error messages the form field with this label shows. */
    async fieldErrors(label: string): Promise<string[]> {
      await harness.fixture.whenStable();
      const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
      return field.getTextErrors();
    },
  };
}

/** What a screen reader announces: the aria-label, or else the text it doesn't hide. */
function accessibleName(element: HTMLElement): string {
  const label = element.getAttribute('aria-label');
  if (label !== null) return label.trim();
  const visible = element.cloneNode(true) as HTMLElement;
  visible.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return (visible.textContent ?? '').trim();
}
