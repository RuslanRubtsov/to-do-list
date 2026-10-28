import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { Problem } from '@api';

/** The HTTP error behind a failed request, also when a resource has wrapped it. */
function httpError(error: unknown): HttpErrorResponse | undefined {
  // A resource wraps errors that aren't Error instances, which HttpErrorResponse isn't
  const cause = error instanceof HttpErrorResponse ? error : (error as Error | undefined)?.cause;
  return cause instanceof HttpErrorResponse ? cause : undefined;
}

/**
 * The backend didn't answer: no response at all, or the reverse proxy in front of it reporting a
 * gateway error. As opposed to the backend answering with an error of its own.
 */
export function isUnreachable(error: unknown): boolean {
  const status = httpError(error)?.status;
  return status !== undefined && UNREACHABLE_STATUSES.has(status);
}

/** The backend refused the request for want of valid credentials. */
export function isUnauthorized(error: unknown): boolean {
  return httpError(error)?.status === HttpStatusCode.Unauthorized;
}

const UNREACHABLE_STATUSES = new Set<number>([
  0,
  HttpStatusCode.BadGateway,
  HttpStatusCode.ServiceUnavailable,
  HttpStatusCode.GatewayTimeout,
]);

/** The Problem Details the backend answered with, if it did. */
export function problemOf(error: unknown): Problem | undefined {
  const body: unknown = httpError(error)?.error;
  return typeof body === 'object' && body !== null && 'code' in body
    ? (body as Problem)
    : undefined;
}

/**
 * Marks each form control the problem names as invalid with `{ server: code }`, where the code is
 * the violated constraint (`SIZE`, `PATTERN`...). Returns whether it marked any.
 */
export function showFieldErrors(form: FormGroup, problem: Problem | undefined): boolean {
  let shown = false;
  for (const { field, code } of problem?.errors ?? []) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...control.errors, server: code });
      control.markAsTouched();
      shown = true;
    }
  }
  return shown;
}
