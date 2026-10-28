import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { ErrorCode, Language } from '@api';
import { map } from 'rxjs';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { returnUrlTree } from './guards';
import { checkPasswordRules, passwordRulesValidator } from './password-rules';
import { Session } from './session';

type RegisterFailure = 'unreachable' | 'unexpected';

export const DISPLAY_NAME_MAX_LENGTH = 100;

@Component({
  selector: 'app-register-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register-page.html',
  styleUrls: ['./auth-page.scss', './register-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);

  /** The page that sent the visitor to log in, from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  protected readonly displayNameMaxLength = DISPLAY_NAME_MAX_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordRulesValidator]],
  });
  protected readonly submitting = signal(false);
  protected readonly failure = signal<RegisterFailure | null>(null);

  /** Which strength rules the password meets so far, shown as a checklist under it. */
  protected readonly passwordRules = toSignal(
    this.form.controls.password.valueChanges.pipe(map(checkPasswordRules)),
    { initialValue: checkPasswordRules('') },
  );

  protected submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.failure.set(null);
    const { displayName, email, password } = this.form.getRawValue();
    this.session
      .register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        // The language the User signed up in, until they choose another
        preferredLanguage: this.locale.startsWith('uk') ? Language.uk : Language.en,
      })
      .subscribe({
        next: () => void this.router.navigateByUrl(returnUrlTree(this.router, this.returnUrl())),
        error: (error: unknown) => {
          this.submitting.set(false);
          this.showFailure(error);
        },
      });
  }

  private showFailure(error: unknown): void {
    const problem = problemOf(error);
    if (problem?.code === ErrorCode.EMAIL_TAKEN) {
      const email = this.form.controls.email;
      email.setErrors({ taken: true });
      email.markAsTouched();
    } else if (!showFieldErrors(this.form, problem)) {
      this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
    }
  }
}
