import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Share, TodoList, TodoListsService } from '@api';
import { tap } from 'rxjs';
import { isNotFound, isUnreachable } from '../http/problems';
import { TaskList } from '../tasks/task-list';
import { DeleteTodoListDialog } from './delete-todo-list-dialog';
import { LeaveTodoListDialog } from './leave-todo-list-dialog';
import { ShareDialog } from './share-dialog';
import { TodoListNameDialog, TodoListNameDialogData } from './todo-list-name-dialog';
import { TodoLists } from './todo-lists';

/**
 * One Todo List and its Tasks. Its Owner may also rename, delete and Share it; a User it was
 * Shared with sees who owns it, and changes its Tasks only as an Editor.
 */
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
  private readonly snackBar = inject(MatSnackBar);

  /** From the route, `/lists/:todoListId`. */
  readonly todoListId = input.required({ transform: numberAttribute });

  protected readonly todoList = rxResource({
    params: () => this.todoListId(),
    stream: ({ params: id }) => this.api.getTodoList(id),
  });
  protected readonly notFound = computed(() => isNotFound(this.todoList.error()));
  /** Whether the Todo List shown has since gone, or is no longer Shared with the User. */
  protected readonly lost = linkedSignal({ source: this.todoListId, computation: () => false });
  /** Whether the Todo List is being read again, to tell whether it is gone. */
  private rechecking = false;
  protected readonly unreachable = computed(() => isUnreachable(this.todoList.error()));

  constructor() {
    // One the User can't reach is no longer theirs to have in the drawer
    effect(() => {
      if (this.notFound()) untracked(() => this.todoLists.forget(this.todoListId()));
    });
  }

  /**
   * Reads the Todo List again once a change to it found something gone, to tell whether the
   * Todo List itself is: if so, says so and drops it from the drawer.
   */
  protected recheck(todoList: TodoList): void {
    // Once is enough, however many changes find something gone meanwhile
    if (this.lost() || this.rechecking) return;
    this.rechecking = true;
    this.todoLists.refresh(todoList.id).subscribe({
      next: (read) => {
        this.rechecking = false;
        this.todoList.set(read);
      },
      error: (error: unknown) => {
        this.rechecking = false;
        if (!isNotFound(error)) return;
        this.lost.set(true);
        this.todoLists.forget(todoList.id);
      },
    });
  }

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

  /** Once Shared, says with whom. */
  protected share(todoList: TodoList): void {
    this.dialogs
      .open<ShareDialog, TodoList, Share>(ShareDialog, { data: todoList })
      .afterClosed()
      .subscribe((share) => {
        if (!share) return;
        this.snackBar.open(
          $localize`:Message after Sharing a Todo List with a User, named by their display name:Shared “${todoList.name}:todoList:” with ${share.displayName}:user:.`,
          $localize`:Dismisses a message:OK`,
        );
      });
  }

  /** Once confirmed and done, goes to the start page; a failure stays and says so. */
  protected leave(todoList: TodoList): void {
    this.dialogs
      .open<LeaveTodoListDialog, TodoList, boolean>(LeaveTodoListDialog, { data: todoList })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.todoLists.leave(todoList).subscribe({
          next: () => {
            void this.router.navigateByUrl('/');
            this.snackBar.open(
              $localize`:Message after the User left a Todo List Shared with them:You left “${todoList.name}:name:”.`,
              $localize`:Dismisses a message:OK`,
            );
          },
          error: () =>
            this.snackBar.open(
              $localize`:Message when leaving a Todo List fails:Couldn’t leave “${todoList.name}:name:”. Check your connection and try again.`,
              $localize`:Dismisses a message:OK`,
            ),
        });
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
