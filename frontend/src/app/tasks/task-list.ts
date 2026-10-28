import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Task, TasksService } from '@api';
import { catchError, map, Observable, of } from 'rxjs';
import { isNotFound, isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { TodoLists } from '../todo-lists/todo-lists';
import { UndoableDeletes } from '../undo/undoable-deletes';
import { TASK_TITLE_MAX_LENGTH, taskTitleValidators } from './task-title';

/**
 * A Todo List's Tasks: adding them, open ones first, then a section of the Completed ones. Keeps
 * the navigation drawer's count of open Tasks in step with what it shows.
 */
@Component({
  selector: 'app-task-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgTemplateOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskList {
  private readonly api = inject(TasksService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly deletes = inject(UndoableDeletes);
  private readonly todoLists = inject(TodoLists);

  readonly todoListId = input.required<number>();

  protected readonly tasks = rxResource({
    params: () => this.todoListId(),
    stream: ({ params: id }) => this.api.getTasks(id),
  });
  protected readonly unreachable = computed(() => isUnreachable(this.tasks.error()));
  /** Deleted, but with the delete not sent yet: Undo can still bring them back. */
  private readonly pendingDeletes = signal<ReadonlySet<number>>(new Set());
  /** What ends the Undo offer of each pending delete, which sends it. */
  private readonly undoOffers = new Map<number, () => void>();

  /** In the order they were added, without those deleted; `undefined` until loaded. */
  private readonly shown = computed(() => {
    if (!this.tasks.hasValue()) return undefined;
    const pending = this.pendingDeletes();
    return this.tasks.value().filter((task) => !pending.has(task.id));
  });
  protected readonly open = computed(() => this.shown()?.filter((task) => !task.completedAt));
  protected readonly completed = computed(
    () => this.shown()?.filter((task) => task.completedAt) ?? [],
  );
  /** Collapsed whenever the section appears, so open work stays in focus. */
  protected readonly showCompleted = linkedSignal({
    source: () => this.completed().length > 0,
    computation: () => false,
  });

  protected readonly titleMaxLength = TASK_TITLE_MAX_LENGTH;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', taskTitleValidators],
  });
  private readonly formDirective = viewChild.required(FormGroupDirective);
  protected readonly adding = signal(false);
  protected readonly addFailure = signal<'unreachable' | 'unexpected' | null>(null);

  constructor() {
    effect(() => {
      const open = this.open();
      const todoListId = this.todoListId();
      // Depends only on what this page shows, not on the drawer it writes to
      if (open) untracked(() => this.todoLists.setOpenTaskCount(todoListId, open.length));
    });
    // Undo is offered for what this page shows; leaving it ends the offers, sending the deletes.
    // Just after, as ending one changes the snack bar, which mustn't happen mid-render.
    inject(DestroyRef).onDestroy(() => {
      const endOffers = [...this.undoOffers.values()];
      queueMicrotask(() => endOffers.forEach((endOffer) => endOffer()));
    });
  }

  /** Adds a Task with the title typed, then clears the field for the next one. */
  protected add(): void {
    if (this.form.invalid || this.adding()) return;
    this.adding.set(true);
    this.addFailure.set(null);
    this.api
      .createTask(this.todoListId(), { title: this.form.getRawValue().title.trim() })
      .subscribe({
        next: (added) => {
          this.adding.set(false);
          this.change((tasks) => [...tasks, added]);
          this.formDirective().resetForm();
        },
        error: (error: unknown) => {
          this.adding.set(false);
          if (!showFieldErrors(this.form, problemOf(error))) {
            this.addFailure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
          }
        },
      });
  }

  protected complete(task: Task): void {
    this.changeCompletion(
      task,
      new Date().toISOString(),
      this.api.completeTask(this.todoListId(), task.id),
    );
  }

  protected uncomplete(task: Task): void {
    this.changeCompletion(task, null, this.api.uncompleteTask(this.todoListId(), task.id));
  }

  /**
   * Shows the Task as changed at once, then as the backend has it. A failure takes the change back
   * and says so.
   */
  private changeCompletion(task: Task, completedAt: string | null, request: Observable<Task>) {
    this.replace({ ...task, completedAt });
    request.subscribe({
      next: (changed) => this.replace(changed),
      error: () => {
        this.replace(task);
        this.snackBar.open(
          $localize`:Message when completing a Task, or taking that back, fails:Couldn’t change “${task.title}:title:”. Check your connection and try again.`,
          $localize`:Dismisses a message:OK`,
        );
      },
    });
  }

  protected deleteLabel(task: Task): string {
    return $localize`:Button that deletes a Task, named by its title:Delete “${task.title}:title:”`;
  }

  /**
   * Hides the Task at once and offers Undo, holding the delete back meanwhile (see
   * {@link UndoableDeletes}). A failed delete brings the Task back.
   */
  protected delete(task: Task): void {
    const todoListId = this.todoListId();
    this.setPending(task.id, true);
    const endOffer = this.deletes.offer({
      message: $localize`:Message after deleting a Task, which can still be undone:Deleted “${task.title}:title:”.`,
      send: () => {
        this.undoOffers.delete(task.id);
        return this.sendDelete(todoListId, task);
      },
      undo: () => {
        this.undoOffers.delete(task.id);
        this.setPending(task.id, false);
      },
    });
    this.undoOffers.set(task.id, endOffer);
  }

  /** Sends the delete; a failure brings the Task back and says so, then completes. */
  private sendDelete(todoListId: number, task: Task): Observable<void> {
    return this.api.deleteTask(todoListId, task.id).pipe(
      map(() => this.forget(task.id)),
      catchError((error: unknown) => {
        // Already gone is as good as deleted
        if (isNotFound(error)) {
          this.forget(task.id);
        } else {
          this.setPending(task.id, false);
          this.snackBar.open(
            $localize`:Message when deleting a Task fails:Couldn’t delete “${task.title}:title:”. Check your connection and try again.`,
            $localize`:Dismisses a message:OK`,
          );
        }
        return of(undefined);
      }),
    );
  }

  private forget(id: number): void {
    this.change((tasks) => tasks.filter((task) => task.id !== id));
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

  private replace(task: Task): void {
    this.change((tasks) => tasks.map((each) => (each.id === task.id ? task : each)));
  }

  private change(apply: (tasks: Task[]) => Task[]): void {
    if (this.tasks.hasValue()) this.tasks.set(apply(this.tasks.value()));
  }
}
