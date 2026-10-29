import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Share, ShareRole, SharingService, TodoList } from '@api';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';

/** As long as the backend allows an email to be. */
const EMAIL_MAX_LENGTH = 254;

/**
 * Shares a Todo List with another registered User, by their email, as a Viewer or an Editor, and
 * closes with the new Share once the backend has it. Also shows whom it is Shared with already, to
 * change their roles or revoke their Shares.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    NgTemplateOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.scss',
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
  /** Whom the Todo List is Shared with, by display name. */
  protected readonly shares = rxResource({
    stream: () => this.api.getShares(this.todoList.id),
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
        if (!showFieldErrors(this.form, problemOf(error))) this.fail(error);
      },
    });
  }

  /** Shows the new role at once; a failure puts the old one back and says so. */
  protected changeRole(share: Share, role: ShareRole): void {
    this.failure.set(null);
    this.replace({ ...share, role });
    this.api.changeShare(this.todoList.id, share.userId, { role }).subscribe({
      next: (changed) => this.replace(changed),
      error: (error: unknown) => {
        this.replace(share);
        this.fail(error);
      },
    });
  }

  /** Once the backend has revoked the Share, no longer shows it; a failure says so. */
  protected revoke(share: Share): void {
    this.failure.set(null);
    this.api.revokeShare(this.todoList.id, share.userId).subscribe({
      next: () =>
        this.shares.update((shares) => shares?.filter((each) => each.userId !== share.userId)),
      error: (error: unknown) => this.fail(error),
    });
  }

  protected roleLabel(share: Share): string {
    return $localize`:Accessible label for the role a Share gives a User, named by their display name:Role of ${share.displayName}:name:`;
  }

  protected revokeLabel(share: Share): string {
    return $localize`:Button that revokes the Share of a User, named by their display name:Stop sharing with ${share.displayName}:name:`;
  }

  private replace(share: Share): void {
    this.shares.update((shares) =>
      shares?.map((each) => (each.userId === share.userId ? share : each)),
    );
  }

  private fail(error: unknown): void {
    this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
  }
}
