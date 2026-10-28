import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TodoList, TodoListsService } from '@api';
import { tap } from 'rxjs';
import { isNotFound, isUnreachable } from '../http/problems';
import { TaskList } from '../tasks/task-list';
import { DeleteTodoListDialog } from './delete-todo-list-dialog';
import { TodoListNameDialog, TodoListNameDialogData } from './todo-list-name-dialog';
import { TodoLists } from './todo-lists';

/** One Todo List and its Tasks, as its Owner sees them. */
@Component({
  selector: 'app-todo-list-page',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink, TaskList],
  templateUrl: './todo-list-page.html',
  styleUrl: './todo-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoListPage {
  private readonly api = inject(TodoListsService);
  private readonly todoLists = inject(TodoLists);
  private readonly dialogs = inject(MatDialog);
  private readonly router = inject(Router);

  /** From the route, `/lists/:todoListId`. */
  readonly todoListId = input.required({ transform: numberAttribute });

  protected readonly todoList = rxResource({
    params: () => this.todoListId(),
    stream: ({ params: id }) => this.api.getTodoList(id),
  });
  protected readonly notFound = computed(() => isNotFound(this.todoList.error()));
  protected readonly unreachable = computed(() => isUnreachable(this.todoList.error()));

  protected rename(todoList: TodoList): void {
    // The version the rename is based on
    let latest = todoList;
    this.dialogs
      .open<TodoListNameDialog, TodoListNameDialogData, TodoList>(TodoListNameDialog, {
        data: {
          todoList,
          save: (name) => this.todoLists.rename(latest, name),
          reload: () =>
            this.todoLists.refresh(todoList.id).pipe(
              tap((read) => {
                latest = read;
                this.todoList.set(read);
              }),
            ),
        },
      })
      .afterClosed()
      .subscribe((renamed) => {
        if (renamed) this.todoList.set(renamed);
      });
  }

  /** Once confirmed, leaves the Todo List for the start page, where Undo is offered. */
  protected delete(todoList: TodoList): void {
    this.dialogs
      .open<DeleteTodoListDialog, TodoList, boolean>(DeleteTodoListDialog, { data: todoList })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.todoLists.delete(todoList);
        void this.router.navigateByUrl('/');
      });
  }
}
