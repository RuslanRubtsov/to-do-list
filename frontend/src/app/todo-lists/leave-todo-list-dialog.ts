import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TodoList } from '@api';

/** Asks before leaving a Todo List Shared with the User. Closes with `true` to leave it. */
@Component({
  selector: 'app-leave-todo-list-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './leave-todo-list-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveTodoListDialog {
  protected readonly todoList = inject<TodoList>(MAT_DIALOG_DATA);
}
