import { HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EventsService, TodoListEvent } from '@api';
import { defer, EMPTY, from, mergeMap, Observable, repeat, retry, throwError, timer } from 'rxjs';
import { isNotFound } from '../http/problems';

/** What following a Todo List brings: each time its stream starts, and each of its events. */
export type LiveUpdate =
  | {
      kind: 'connected';
      /** Whether it started again, after a stream that dropped or ended: events may have been missed. */
      again: boolean;
    }
  | { kind: 'event'; event: TodoListEvent };

/** How long to wait before following again: from a second, doubling each time, up to half a minute. */
function delayBefore(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 30_000);
}

/** A Todo List's events stream (`getTodoListEvents`), followed for as long as it is subscribed to. */
@Injectable({ providedIn: 'root' })
export class TodoListEvents {
  private readonly api = inject(EventsService);

  /**
   * Follows the Todo List's events. Follows it again whenever the stream drops, as on a network
   * blip, or the backend ends it; gives up only once the Todo List is no longer the User's to reach.
   */
  follow(todoListId: number): Observable<LiveUpdate> {
    let streams = 0;
    return defer(() => {
      const again = streams++ > 0;
      return this.api.getTodoListEvents(todoListId, 'events', true).pipe(updatesFrom(again));
    }).pipe(
      repeat({ delay: () => timer(delayBefore(1)) }),
      retry({
        delay: (error: unknown, attempt) =>
          isNotFound(error) ? throwError(() => error) : timer(delayBefore(attempt)),
        resetOnSuccess: true,
      }),
    );
  }
}

/**
 * The updates in a stream's text as it arrives: each message ends with a blank line, and has its
 * event as JSON on `data:` lines. Comments, such as heartbeats, carry none.
 */
function updatesFrom(again: boolean) {
  return (source: Observable<HttpEvent<string>>): Observable<LiveUpdate> =>
    defer(() => {
      let read = 0;
      let connected = false;
      return source.pipe(
        mergeMap((httpEvent) => {
          const text = textOf(httpEvent);
          if (text === undefined) return EMPTY;
          const updates: LiveUpdate[] = [];
          for (let end = text.indexOf('\n\n', read); end >= 0; end = text.indexOf('\n\n', read)) {
            const message = text.slice(read, end);
            read = end + 2;
            if (!connected) {
              connected = true;
              updates.push({ kind: 'connected', again });
            }
            const data = message
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice('data:'.length).trimStart())
              .join('\n');
            if (data) updates.push({ kind: 'event', event: JSON.parse(data) as TodoListEvent });
          }
          return from(updates);
        }),
      );
    });
}

/** All the stream's text so far, as it arrives and once it ends. */
function textOf(httpEvent: HttpEvent<string>): string | undefined {
  if (httpEvent.type === HttpEventType.DownloadProgress) return httpEvent.partialText;
  if (httpEvent.type === HttpEventType.Response) return httpEvent.body ?? undefined;
  return undefined;
}
