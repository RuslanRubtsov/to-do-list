import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TodoList } from '@api';
import { Observable } from 'rxjs';
import { isEditConflict, isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { TODO_LIST_NAME_MAX_LENGTH, todoListNameValidators } from './todo-list-name';

export interface TodoListNameDialogData {
  /** The Todo List to rename; none to create one. */
  todoList?: TodoList;
  /** Sends the name to the backend; a rename, as a change to the version of it last read. */
  save: (name: string) => Observable<TodoList>;
  /** Reads the Todo List to rename again, once someone else's change replaced the version read. */
  reload?: () => Observable<TodoList>;
}

/**
 * Names a new Todo List, or renames one. Closes with the saved Todo List once the backend has it. If
 * someone else changed the Todo List meanwhile, shows its latest name instead, to rename again.
 */
@Component({
  selector: 'app-todo-list-name-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './todo-list-name-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoListNameDialog {
  protected readonly data = inject<TodoListNameDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject<MatDialogRef<TodoListNameDialog, TodoList>>(MatDialogRef);

  protected readonly nameMaxLength = TODO_LIST_NAME_MAX_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.todoList?.name ?? '', todoListNameValidators],
  });
  protected readonly saving = signal(false);
  protected readonly failure = signal<'conflict' | 'unreachable' | 'unexpected' | null>(null);

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.data.save(this.form.getRawValue().name.trim()).subscribe({
      next: (saved) => this.dialog.close(saved),
      error: (error: unknown) => {
        const reload = this.data.reload;
        if (reload && isEditConflict(error)) this.showLatest(reload);
        else this.fail(error);
      },
    });
  }

  /** Shows the name someone else just gave the Todo List, for the User to rename it again. */
  private showLatest(reload: () => Observable<TodoList>): void {
    reload().subscribe({
      next: (latest) => {
        this.saving.set(false);
        this.form.reset({ name: latest.name });
        this.failure.set('conflict');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    if (!showFieldErrors(this.form, problemOf(error))) {
      this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
    }
  }
}
