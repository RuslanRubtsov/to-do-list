import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService, AuthSession, LoginRequest, RegisterRequest } from '@api';
import {
  catchError,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { isUnauthorized } from '../http/problems';

/** The Web Lock tabs take turns refreshing the session under. */
export const SESSION_REFRESH_LOCK = 'todo.session-refresh';

/**
 * Who is logged in. The access token lives only here, in memory; what survives a reload is the
 * refresh token, in a cookie JavaScript can't read, which {@link restore} trades for a new one.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly auth = inject(AuthService);
  private readonly current = signal<AuthSession | null>(null);
  private restored?: Promise<void>;
  private refreshing?: Observable<string | null>;
  /** Counts confirmed logouts, so a refresh that was under way at the time can tell. */
  private logOuts = 0;

  /** The logged-in User, or `null` for a visitor. */
  readonly user = computed(() => this.current()?.user ?? null);
  readonly accessToken = computed(() => this.current()?.accessToken ?? null);

  /**
   * Picks up the session the refresh token cookie holds, if any. Asks the backend once per page
   * load; later calls wait for that answer.
   */
  restore(): Promise<void> {
    this.restored ??= firstValueFrom(
      this.refreshAccessToken().pipe(
        map(() => undefined),
        // No session we can reach is no session yet: a visitor
        catchError(() => of(undefined)),
      ),
    );
    return this.restored;
  }

  /**
   * Trades the refresh token cookie for a new access token, and the cookie for a new one (the
   * backend rotates it). A second refresh alongside the first would present the token the first
   * is rotating, which the backend treats as theft and answers by ending the session. So callers
   * in this tab share one refresh, and tabs take turns: every tab sends the same cookie, and the
   * next one in turn sends the cookie the previous one was given.
   *
   * Emits the new access token, or `null` when the session has ended, which logs the User out
   * here too. Fails, keeping the session, when the backend can't be asked.
   */
  refreshAccessToken(): Observable<string | null> {
    const loggedOutBefore = this.logOuts;
    this.refreshing ??= inTurnWithOtherTabs(() => this.auth.refreshSession()).pipe(
      // Logging out while the refresh was under way wins: the backend revoked the session
      map((session) => (this.logOuts === loggedOutBefore ? session : null)),
      catchError((error: unknown) => (isUnauthorized(error) ? of(null) : throwError(() => error))),
      tap((session) => this.current.set(session)),
      map((session) => session?.accessToken ?? null),
      finalize(() => (this.refreshing = undefined)),
      shareReplay(1),
    );
    return this.refreshing;
  }

  logIn(credentials: LoginRequest): Observable<void> {
    return this.auth.login(credentials).pipe(
      tap((session) => this.current.set(session)),
      map(() => undefined),
    );
  }

  /** Registers a new User and logs them straight in. */
  register(request: RegisterRequest): Observable<void> {
    return this.auth
      .register(request)
      .pipe(switchMap(() => this.logIn({ email: request.email, password: request.password })));
  }

  /**
   * Ends the session on the backend, which revokes the refresh token and clears its cookie. Until
   * the backend confirms, the User stays logged in: forgetting the session here alone would bring
   * it back on the next reload.
   */
  logOut(): Observable<void> {
    return this.auth.logout().pipe(
      tap(() => {
        this.logOuts++;
        this.current.set(null);
      }),
      map(() => undefined),
    );
  }
}

/**
 * Runs `request` holding a lock every tab of the app shares, so tabs take turns. Browsers
 * without the Web Locks API just run it.
 */
function inTurnWithOtherTabs<T>(request: () => Observable<T>): Observable<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return request();
  return from(locks.request(SESSION_REFRESH_LOCK, () => firstValueFrom(request())));
}
