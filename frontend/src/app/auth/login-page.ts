import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { ErrorCode } from '@api';
import { isUnreachable, problemOf } from '../http/problems';
import { returnUrlTree } from './guards';
import { Session } from './session';

type LoginFailure = 'credentials' | 'unreachable' | 'unexpected';

@Component({
  selector: 'app-login-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login-page.html',
  styleUrl: './auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  /** The page that sent the visitor here, from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly failure = signal<LoginFailure | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.failure.set(null);
    this.session.logIn(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl(returnUrlTree(this.router, this.returnUrl())),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.failure.set(loginFailure(error));
      },
    });
  }
}

function loginFailure(error: unknown): LoginFailure {
  if (isUnreachable(error)) return 'unreachable';
  return problemOf(error)?.code === ErrorCode.INVALID_CREDENTIALS ? 'credentials' : 'unexpected';
}
