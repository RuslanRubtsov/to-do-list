import { inject, LOCALE_ID, Provider } from '@angular/core';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { enUS } from 'date-fns/locale/en-US';
import { uk } from 'date-fns/locale/uk';

/**
 * Date pickers that read and write dates the way the active locale does: 11/3/2026 in English,
 * 03.11.2026 in Ukrainian.
 */
export function provideLocaleDates(): Provider[] {
  return [
    provideDateFnsAdapter(),
    {
      provide: MAT_DATE_LOCALE,
      useFactory: () => (inject(LOCALE_ID).startsWith('uk') ? uk : enUS),
    },
  ];
}
