import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TodoList } from '@api';

/** Asks before deleting a Todo List. Closes with `true` to delete it. */
@Component({
  selector: 'app-delete-todo-list-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './delete-todo-list-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteTodoListDialog {
  protected readonly todoList = inject<TodoList>(MAT_DIALOG_DATA);
}
