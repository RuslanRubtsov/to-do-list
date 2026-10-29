import { HttpEventType } from '@angular/common/http';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TodoListEvent } from '@api';

/** Following a Todo List's events. */
export function eventsRequest(todoListId: number) {
  return { method: 'GET', url: `/api/v1/todo-lists/${todoListId}/events` };
}

/**
 * A Todo List's events stream, as the backend sends it: the request stays open, and each event
 * arrives as more of its text.
 */
export class FakeEventStream {
  private text = '';

  constructor(readonly request: TestRequest) {}

  /** The stream starts, as the backend starts each one. */
  connect(): void {
    this.append(':connected\n\n');
  }

  send(event: TodoListEvent): void {
    this.append(`data:${JSON.stringify(event)}\n\n`);
  }

  heartbeat(): void {
    this.append(':heartbeat\n\n');
  }

  /** The connection drops, as in a network blip. */
  drop(): void {
    this.request.error(new ProgressEvent('error'), { status: 0 });
  }

  /** The backend ends the stream. */
  end(): void {
    this.request.flush(this.text);
  }

  private append(text: string): void {
    this.text += text;
    this.request.event({
      type: HttpEventType.DownloadProgress,
      loaded: this.text.length,
      partialText: this.text,
    });
  }
}

/**
 * Waits for the app to follow the Todo List's events, as a stream the backend accepts, and starts
 * the stream.
 */
export async function answerEvents(
  http: HttpTestingController,
  todoListId: number,
): Promise<FakeEventStream> {
  const request = await vi.waitFor(() => http.expectOne(eventsRequest(todoListId)));
  // As the backend needs it, or it refuses the request: a stream, read as text as it arrives
  expect(request.request.headers.get('Accept')).toBe('text/event-stream');
  expect(request.request.responseType).toBe('text');
  expect(request.request.reportProgress).toBe(true);
  const stream = new FakeEventStream(request);
  stream.connect();
  return stream;
}
