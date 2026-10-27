import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Phones get the overlay navigation drawer. shell.scss repeats this width for its padding. */
export const PHONE_QUERY = Breakpoints.XSmall;
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** Whether a media query matches, kept up to date as the browser changes. */
export function mediaMatches(query: string): Signal<boolean> {
  const observer = inject(BreakpointObserver);
  return toSignal(observer.observe(query).pipe(map((state) => state.matches)), {
    initialValue: observer.isMatched(query),
  });
}
