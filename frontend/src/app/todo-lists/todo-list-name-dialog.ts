import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TodoList } from '@api';
import { Observable } from 'rxjs';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { TODO_LIST_NAME_MAX_LENGTH, todoListNameValidators } from './todo-list-name';

export interface TodoListNameDialogData {
  /** The Todo List to rename; none to create one. */
  todoList?: TodoList;
  /** Sends the name to the backend. */
  save: (name: string) => Observable<TodoList>;
}

/** Names a new Todo List, or renames one. Closes with the saved Todo List once the backend has it. */
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
  protected readonly failure = signal<'unreachable' | 'unexpected' | null>(null);

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.data.save(this.form.getRawValue().name.trim()).subscribe({
      next: (saved) => this.dialog.close(saved),
      error: (error: unknown) => {
        this.saving.set(false);
        if (!showFieldErrors(this.form, problemOf(error))) {
          this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
        }
      },
    });
  }
}
