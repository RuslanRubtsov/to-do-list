import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService, AuthSession, LoginRequest, RegisterRequest } from '@api';
import { catchError, firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';

/**
 * Who is logged in. The access token lives only here, in memory; what survives a reload is the
 * refresh token, in a cookie JavaScript can't read, which {@link restore} trades for a new one.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly auth = inject(AuthService);
  private readonly current = signal<AuthSession | null>(null);
  private restored?: Promise<void>;

  /** The logged-in User, or `null` for a visitor. */
  readonly user = computed(() => this.current()?.user ?? null);
  readonly accessToken = computed(() => this.current()?.accessToken ?? null);

  /**
   * Picks up the session the refresh token cookie holds, if any. Asks the backend once per page
   * load; later calls wait for that answer.
   */
  restore(): Promise<void> {
    this.restored ??= firstValueFrom(
      this.auth.refreshSession().pipe(
        tap((session) => this.current.set(session)),
        map(() => undefined),
        // No session, or none we can reach: either way, a visitor
        catchError(() => of(undefined)),
      ),
    );
    return this.restored;
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
      tap(() => this.current.set(null)),
      map(() => undefined),
    );
  }
}
