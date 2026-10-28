import { computed, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TodoList, TodoListsService } from '@api';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { isNotFound } from '../http/problems';
import { UndoableDeletes } from '../undo/undoable-deletes';

/**
 * The User's Todo Lists, as the navigation drawer shows them. Provided by the app shell, so it lives
 * as long as a logged-in User's session in this tab.
 */
@Injectable()
export class TodoLists {
  private readonly api = inject(TodoListsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly collator = new Intl.Collator(inject(LOCALE_ID));
  private readonly deletes = inject(UndoableDeletes);

  private readonly loaded = rxResource({ stream: () => this.api.getTodoLists() });
  /** Deleted, but with the delete not sent yet: Undo can still bring them back. */
  private readonly pendingDeletes = signal<ReadonlySet<number>>(new Set());

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

  /** Renames the Todo List, as a change to the version of it given. */
  rename(todoList: TodoList, name: string): Observable<TodoList> {
    return this.api
      .renameTodoList(todoList.id, { name, version: todoList.version })
      .pipe(tap((renamed) => this.replace(renamed)));
  }

  /** Reads the Todo List again, as someone else may have changed it, and shows it as it is now. */
  refresh(id: number): Observable<TodoList> {
    return this.api.getTodoList(id).pipe(tap((read) => this.replace(read)));
  }

  /** Shows how many of the Todo List's Tasks are open, as the page showing them knows it. */
  setOpenTaskCount(id: number, openTaskCount: number): void {
    this.change((todoLists) =>
      todoLists.map((todoList) => (todoList.id === id ? { ...todoList, openTaskCount } : todoList)),
    );
  }

  /**
   * Hides the Todo List at once and offers Undo, holding the delete back meanwhile (see
   * {@link UndoableDeletes}). A failed delete brings the Todo List back.
   */
  delete(todoList: TodoList): void {
    this.setPending(todoList.id, true);
    this.deletes.offer({
      message: $localize`:Message after deleting a Todo List, which can still be undone:Deleted “${todoList.name}:name:”.`,
      send: () => this.sendDelete(todoList),
      undo: () => this.setPending(todoList.id, false),
    });
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

  private replace(todoList: TodoList): void {
    this.change((todoLists) =>
      todoLists.map((each) => (each.id === todoList.id ? todoList : each)),
    );
  }

  /** Applies a change the backend confirmed, keeping the Todo Lists sorted by name. */
  private change(apply: (todoLists: TodoList[]) => TodoList[]): void {
    if (!this.loaded.hasValue()) return;
    this.loaded.set(
      apply(this.loaded.value()).sort((a, b) => this.collator.compare(a.name, b.name)),
    );
  }
}
