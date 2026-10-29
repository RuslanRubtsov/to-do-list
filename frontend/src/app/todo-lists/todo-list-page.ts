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
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Share, TodoList, TodoListEventTypeEnum, TodoListsService } from '@api';
import { catchError, distinctUntilChanged, EMPTY, switchMap, tap } from 'rxjs';
import { Session } from '../auth/session';
import { isNotFound, isUnreachable } from '../http/problems';
import { TaskList } from '../tasks/task-list';
import { DeleteTodoListDialog } from './delete-todo-list-dialog';
import { LeaveTodoListDialog } from './leave-todo-list-dialog';
import { ShareDialog } from './share-dialog';
import { LiveUpdate, TodoListEvents } from './todo-list-events';
import { TodoListNameDialog, TodoListNameDialogData } from './todo-list-name-dialog';
import { TodoLists } from './todo-lists';

/**
 * One Todo List and its Tasks. Its Owner may also rename, delete and Share it; a User it was
 * Shared with sees who owns it, and changes its Tasks only as an Editor. Follows the Todo List's
 * events while it is shown, so that others' changes show as they happen.
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
  private readonly session = inject(Session);
  private readonly taskList = viewChild(TaskList);

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
  /** The Todo List whose events to follow: the one shown, once loaded, for as long as it's there. */
  private readonly followed = computed(() =>
    this.todoList.hasValue() && !this.lost() ? this.todoListId() : undefined,
  );

  constructor() {
    // One the User can't reach is no longer theirs to have in the drawer
    effect(() => {
      if (this.notFound()) untracked(() => this.todoLists.forget(this.todoListId()));
    });
    const events = inject(TodoListEvents);
    toObservable(this.followed)
      .pipe(
        distinctUntilChanged(),
        // Once no longer the User's to reach, the page says so: nothing more to follow
        switchMap((id) =>
          id === undefined
            ? EMPTY
            : events.follow(id).pipe(
                // No longer followable: reading it again tells whether it is gone, as it may be
                catchError(() => {
                  const todoList = this.todoList.value();
                  if (todoList) this.recheck(todoList);
                  return EMPTY;
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((update) => this.apply(update));
  }

  /** Shows the Todo List as another's change, or a stream started again after a gap, leaves it. */
  private apply(update: LiveUpdate): void {
    const todoList = this.todoList.value();
    if (!todoList) return;
    if (update.kind === 'connected') {
      // What changed while the stream was down
      if (update.again) this.catchUp(todoList);
      return;
    }
    const { event } = update;
    switch (event.type) {
      case TodoListEventTypeEnum.TODO_LIST_RENAMED:
        if (event.name !== undefined && event.version !== undefined) {
          const renamed = { ...todoList, name: event.name, version: event.version };
          this.todoList.set(renamed);
          this.todoLists.showRenamed(renamed);
        }
        break;
      case TodoListEventTypeEnum.TODO_LIST_DELETED:
        this.markLost(todoList);
        break;
      case TodoListEventTypeEnum.SHARE_REVOKED:
        if (event.userId === this.session.user()?.id) this.markLost(todoList);
        break;
      default:
        // A change to its Tasks: they show as the view asks for them, filtered, sorted and paged
        this.taskList()?.refresh();
    }
  }

  private catchUp(todoList: TodoList): void {
    this.recheck(todoList);
    this.taskList()?.refresh();
  }

  /** Says the Todo List is no longer available, and drops it from the drawer. */
  private markLost(todoList: TodoList): void {
    this.lost.set(true);
    this.todoLists.forget(todoList.id);
  }

  /**
   * Reads the Todo List again, as someone else changed it, or as a change to it found something
   * gone: if the Todo List itself is, says so and drops it from the drawer.
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
        if (isNotFound(error)) this.markLost(todoList);
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
