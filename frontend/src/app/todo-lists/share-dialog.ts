import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Share, ShareRole, SharingService, TodoList } from '@api';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';

/** As long as the backend allows an email to be. */
const EMAIL_MAX_LENGTH = 254;

/**
 * Shares a Todo List with another registered User, by their email, as a Viewer or an Editor.
 * Closes with the new Share once the backend has it.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './share-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  protected readonly todoList = inject<TodoList>(MAT_DIALOG_DATA);
  private readonly dialog = inject<MatDialogRef<ShareDialog, Share>>(MatDialogRef);
  private readonly api = inject(SharingService);

  protected readonly roles = [ShareRole.VIEWER, ShareRole.EDITOR];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(EMAIL_MAX_LENGTH)]],
    // The least access, unless the Owner gives more
    role: [ShareRole.VIEWER],
  });
  protected readonly sharing = signal(false);
  protected readonly failure = signal<'unreachable' | 'unexpected' | null>(null);

  protected share(): void {
    if (this.form.invalid || this.sharing()) return;
    this.sharing.set(true);
    this.failure.set(null);
    const { email, role } = this.form.getRawValue();
    this.api.createShare(this.todoList.id, { email: email.trim(), role }).subscribe({
      next: (share) => this.dialog.close(share),
      error: (error: unknown) => {
        this.sharing.set(false);
        if (!showFieldErrors(this.form, problemOf(error))) {
          this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
        }
      },
    });
  }
}
