import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { appConfig } from '../app/app.config';

/**
 * Renders a real routed page with the real app configuration, faking only the HTTP backend
 * beneath the generated API client.
 */
export async function renderRoute(url: string) {
  TestBed.configureTestingModule({
    providers: [...appConfig.providers, provideHttpClientTesting()],
  });
  const harness = await RouterTestingHarness.create();
  const http = TestBed.inject(HttpTestingController);
  await harness.navigateByUrl(url);
  TestBed.tick();

  return {
    http,
    /** Lets the page react to flushed responses, then returns its rendered text. */
    async text(): Promise<string> {
      await harness.fixture.whenStable();
      return harness.routeNativeElement?.textContent ?? '';
    },
    /** Clicks the button with this label and lets the page start reacting (e.g. send requests). */
    click(label: string): void {
      const button = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
        (candidate) => candidate.textContent?.includes(label),
      );
      if (!button) throw new Error(`No button labelled "${label}"`);
      button.click();
      TestBed.tick();
    },
  };
}
