import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
// One module per function: the date-fns index would bring the whole library along
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { parseISO } from 'date-fns/parseISO';

/**
 * A date (`2026-11-03`) as the User would say it: "yesterday", "today" or "tomorrow" when it is
 * that close, else the date itself, all in the active locale. Today is the browser's.
 */
@Pipe({ name: 'relativeDate' })
export class RelativeDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly days = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

  transform(isoDate: string): string {
    const date = parseISO(isoDate);
    const fromToday = differenceInCalendarDays(date, new Date());
    return Math.abs(fromToday) <= 1
      ? this.days.format(fromToday, 'day')
      : formatDate(date, 'mediumDate', this.locale);
  }
}
