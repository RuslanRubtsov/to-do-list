import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Session } from '../auth/session';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { DISPLAY_NAME_MAX_LENGTH, displayNameValidators } from './display-name';

type Outcome = 'saved' | 'unreachable' | 'unexpected';

/** The logged-in User's own details. The language is changed from the toolbar. */
@Component({
  selector: 'app-profile-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly session = inject(Session);

  /** The app's pages are only shown to a logged-in User (see `loggedInGuard`). */
  protected readonly user = this.session.user;
  protected readonly displayNameMaxLength = DISPLAY_NAME_MAX_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: [this.session.user()?.displayName ?? '', displayNameValidators],
  });
  protected readonly saving = signal(false);
  protected readonly outcome = signal<Outcome | null>(null);

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.outcome.set(null);
    this.session
      .updateProfile({ displayName: this.form.getRawValue().displayName.trim() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.outcome.set('saved');
          this.form.markAsPristine();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          if (!showFieldErrors(this.form, problemOf(error))) {
            this.outcome.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
          }
        },
      });
  }
}
