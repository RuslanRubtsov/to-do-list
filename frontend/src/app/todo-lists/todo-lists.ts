import { computed, DestroyRef, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TodoList, TodoListsService } from '@api';
import { MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, map, Observable, of, Subscription, tap } from 'rxjs';
import { isNotFound } from '../http/problems';

/** How long a deleted Todo List can be brought back before the delete is sent. */
const UNDO_DURATION_MS = 5000;

/**
 * The User's Todo Lists, as the navigation drawer shows them. Provided by the app shell, so it lives
 * as long as a logged-in User's session in this tab.
 */
@Injectable()
export class TodoLists {
  private readonly api = inject(TodoListsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly collator = new Intl.Collator(inject(LOCALE_ID));
  private readonly destroyRef = inject(DestroyRef);

  private readonly loaded = rxResource({ stream: () => this.api.getTodoLists() });
  /** Deleted, but with the delete not sent yet: Undo can still bring them back. */
  private readonly pendingDeletes = signal<ReadonlySet<number>>(new Set());
  /** The Undo offer of each pending delete, and what sends the delete once it is gone. */
  private readonly undoOffers = new Map<
    number,
    { todoList: TodoList; offer: MatSnackBarRef<TextOnlySnackBar>; onGone: Subscription }
  >();

  /** By name, as the backend sorts them; `undefined` until loaded. */
  readonly all = computed(() => {
    if (!this.loaded.hasValue()) return undefined;
    const pending = this.pendingDeletes();
    return this.loaded.value().filter((todoList) => !pending.has(todoList.id));
  });
  readonly loadFailed = computed(() => this.loaded.error() !== undefined);

  reload(): void {
    this.loaded.reload();
  }

  create(name: string): Observable<TodoList> {
    return this.api
      .createTodoList({ name })
      .pipe(tap((created) => this.change((todoLists) => [...todoLists, created])));
  }

  rename(id: number, name: string): Observable<TodoList> {
    return this.api
      .renameTodoList(id, { name })
      .pipe(
        tap((renamed) =>
          this.change((todoLists) =>
            todoLists.map((todoList) => (todoList.id === id ? renamed : todoList)),
          ),
        ),
      );
  }

  /**
   * Hides the Todo List at once and offers Undo. The delete is sent only once the offer times out
   * or gives way to another message; Undo sends nothing. A failed delete brings the Todo List back.
   *
   * Logging out sends the deletes still pending first (see {@link sendPendingDeletes}). Leaving
   * the app shell otherwise, as when the session can no longer be refreshed, can't send them: the
   * offer is withdrawn and the Todo List kept.
   */
  delete(todoList: TodoList): void {
    this.setPending(todoList.id, true);
    const offer = this.snackBar.open(
      $localize`:Message after deleting a Todo List, which can still be undone:Deleted “${todoList.name}:name:”.`,
      $localize`:Button that brings back what was just deleted:Undo`,
      { duration: UNDO_DURATION_MS },
    );
    const withdraw = this.destroyRef.onDestroy(() => offer.dismiss());
    const onGone = offer
      .afterDismissed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ dismissedByAction: undone }) => {
        withdraw();
        this.undoOffers.delete(todoList.id);
        if (undone) {
          this.setPending(todoList.id, false);
        } else {
          this.sendDelete(todoList).subscribe();
        }
      });
    this.undoOffers.set(todoList.id, { todoList, offer, onGone });
  }

  /** Ends every Undo offer still open and sends its delete, completing once they are answered. */
  sendPendingDeletes(): Observable<void> {
    const deletes = [...this.undoOffers.values()].map(({ todoList, offer, onGone }) => {
      onGone.unsubscribe();
      offer.dismiss();
      return this.sendDelete(todoList);
    });
    this.undoOffers.clear();
    return deletes.length ? forkJoin(deletes).pipe(map(() => undefined)) : of(undefined);
  }

  /** Sends the delete; a failure brings the Todo List back and says so, then completes. */
  private sendDelete(todoList: TodoList): Observable<void> {
    return this.api.deleteTodoList(todoList.id).pipe(
      map(() => this.forget(todoList.id)),
      catchError((error: unknown) => {
        // Already gone is as good as deleted
        if (isNotFound(error)) {
          this.forget(todoList.id);
        } else {
          this.setPending(todoList.id, false);
          this.snackBar.open(
            $localize`:Message when deleting a Todo List fails:Couldn’t delete “${todoList.name}:name:”. Check your connection and try again.`,
            $localize`:Dismisses a message:OK`,
          );
        }
        return of(undefined);
      }),
    );
  }

  private forget(id: number): void {
    this.change((todoLists) => todoLists.filter((todoList) => todoList.id !== id));
    this.setPending(id, false);
  }

  private setPending(id: number, pending: boolean): void {
    this.pendingDeletes.update((ids) => {
      const updated = new Set(ids);
      if (pending) updated.add(id);
      else updated.delete(id);
      return updated;
    });
  }

  /** Applies a change the backend confirmed, keeping the Todo Lists sorted by name. */
  private change(apply: (todoLists: TodoList[]) => TodoList[]): void {
    if (!this.loaded.hasValue()) return;
    this.loaded.set(
      apply(this.loaded.value()).sort((a, b) => this.collator.compare(a.name, b.name)),
    );
  }
}
