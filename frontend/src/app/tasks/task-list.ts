import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
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
  ResourceRef,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Placement, Task, TaskPage, TaskSort, TasksService } from '@api';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { isNotFound, isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { TodoLists } from '../todo-lists/todo-lists';
import { UndoableDeletes } from '../undo/undoable-deletes';
import { RelativeDatePipe } from './relative-date.pipe';
import type { TaskDetailsDialog, TaskDetailsDialogData } from './task-details-dialog';
import { TaskFilters } from './task-filters';
import { TASK_TITLE_MAX_LENGTH, taskTitleValidators } from './task-title';
import {
  isFiltered,
  queryParamsOf,
  sameFilters,
  showsAllOpen,
  TaskView,
  viewFrom,
} from './task-view';

/** How many Tasks a page shows. */
const PAGE_SIZE = 50;

/**
 * A Todo List's Tasks with their details: adding, changing, moving and finding them. Shows a page
 * of the open Tasks the view in the URL asks for, then a section of the Completed ones; or a page
 * of only one or the other. Keeps the navigation drawer's count of open Tasks in step.
 */
@Component({
  selector: 'app-task-list',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RelativeDatePipe,
    TaskFilters,
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
  private readonly dialogs = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly todoListId = input.required<number>();

  protected readonly view = toSignal(this.route.queryParamMap.pipe(map(viewFrom)), {
    requireSync: true,
  });
  /** The view apart from its page, which only the first list pages through. */
  private readonly filters = computed(() => ({ ...this.view(), page: 0 }), { equal: sameFilters });
  /** While any filter, sort or search is on, dragging Tasks into place is off: it would be ambiguous. */
  protected readonly filtered = computed(() => isFiltered(this.view()));
  /** Whether the first list holds Completed Tasks, as it does when only those are shown. */
  protected readonly mainIsCompleted = computed(() => this.view().show === 'completed');
  /** Whether open and Completed Tasks are both shown, each in a list of their own. */
  private readonly showsBoth = computed(() => this.view().show === undefined);

  /** The page of Tasks shown first: open ones, unless only Completed ones are shown. */
  protected readonly main = rxResource({
    params: () => ({ todoListId: this.todoListId(), view: this.view() }),
    stream: ({ params }) =>
      this.query(params.todoListId, params.view, params.view.show === 'completed'),
  });
  /** When open and Completed Tasks are both shown, the first page of the Completed ones. */
  protected readonly completedSection = rxResource({
    // Not on paging through the open ones: it reads only what changes the Completed ones
    params: () =>
      this.showsBoth() ? { todoListId: this.todoListId(), view: this.filters() } : undefined,
    stream: ({ params }) => this.query(params.todoListId, params.view, true),
  });
  protected readonly unreachable = computed(() => isUnreachable(this.main.error()));
  /** Deleted, but with the delete not sent yet: Undo can still bring them back. */
  private readonly pendingDeletes = signal<ReadonlySet<number>>(new Set());
  /** What ends the Undo offer of each pending delete, which sends it. */
  private readonly undoOffers = new Map<number, () => void>();
  /** Whether the page has gone, as it may while a dialog is still loading. */
  private destroyed = false;

  /** The first list's Tasks, without those deleted; `undefined` until loaded. */
  protected readonly mainTasks = computed(() => this.shownIn(this.main));
  protected readonly totalPages = computed(() => this.main.value()?.totalPages ?? 0);
  protected readonly completed = computed(() => this.shownIn(this.completedSection) ?? []);
  /** How many Completed Tasks match in all, not only those on the section's page. */
  protected readonly completedCount = computed(
    () => this.countIn(this.completedSection, this.completed()) ?? 0,
  );
  /** Collapsed whenever the section appears, so open work stays in focus. */
  protected readonly showCompleted = linkedSignal({
    source: () => this.completedCount() > 0,
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
      const open = this.mainTasks();
      const count = open && showsAllOpen(this.view()) ? this.countIn(this.main, open) : undefined;
      const todoListId = this.todoListId();
      // Depends only on what this page shows, not on the drawer it writes to
      if (count !== undefined) {
        untracked(() => this.todoLists.setOpenTaskCount(todoListId, count));
      }
    });
    // Undo is offered for what this page shows; leaving it ends the offers, sending the deletes.
    // Just after, as ending one changes the snack bar, which mustn't happen mid-render.
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
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
          // At the end of the manual order: on the last page, unless a filter or sort places it
          const page = this.main.value();
          if (this.filtered() || (page && page.page < page.totalPages - 1)) this.main.reload();
          else this.changeIn(this.main, (tasks) => [...tasks, added]);
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

  /** Takes the open Task out of the open ones at once; the Completed ones then show it. */
  protected complete(task: Task): void {
    this.changeCompletion(task, this.main, this.api.completeTask(this.todoListId(), task.id), () =>
      this.completedSection.reload(),
    );
  }

  /** Takes the Completed Task out of the Completed ones at once; the open ones then show it. */
  protected uncomplete(task: Task): void {
    const from = this.mainIsCompleted() ? this.main : this.completedSection;
    this.changeCompletion(task, from, this.api.uncompleteTask(this.todoListId(), task.id), () => {
      if (from === this.completedSection) this.main.reload();
    });
  }

  /**
   * Takes the Task out of the list it's in at once, then lets the other list show it as the
   * backend has it, in its place there. A failure puts it back and says so.
   */
  private changeCompletion(
    task: Task,
    from: ResourceRef<TaskPage | undefined>,
    request: Observable<Task>,
    showInOther: () => void,
  ) {
    const putBack = this.takeOut(from, task);
    request.subscribe({
      next: () => showInOther(),
      error: () => {
        putBack();
        this.snackBar.open(
          $localize`:Message when completing a Task, or taking that back, fails:Couldn’t change “${task.title}:title:”. Check your connection and try again.`,
          $localize`:Dismisses a message:OK`,
        );
      },
    });
  }

  /**
   * Moves the open Task dragged from one place to another: just before the Task it was dropped on
   * when dragged up, just after it when dragged down. Shows the move at once, then sends it; a
   * failure takes it back and says so.
   */
  protected drop(open: Task[], { previousIndex, currentIndex }: CdkDragDrop<unknown>): void {
    if (previousIndex === currentIndex) return;
    const task = open[previousIndex];
    const relativeTo = open[currentIndex];
    const placement = currentIndex < previousIndex ? Placement.BEFORE : Placement.AFTER;
    const placesBefore = new Map(this.main.value()?.items.map((each, index) => [each.id, index]));
    this.changeIn(this.main, (tasks) => placed(tasks, task, placement, relativeTo));
    this.api
      .moveTask(this.todoListId(), task.id, { placement, relativeTo: relativeTo.id })
      .subscribe({
        next: (moved) => this.replace(moved),
        error: () => {
          // Back in the order from before the move; any Task added since stays at the end
          const placeBefore = (each: Task) => placesBefore.get(each.id) ?? placesBefore.size;
          this.changeIn(this.main, (tasks) =>
            [...tasks].sort((a, b) => placeBefore(a) - placeBefore(b)),
          );
          this.snackBar.open(
            $localize`:Message when moving a Task to another place in its Todo List fails:Couldn’t move “${task.title}:title:”. Check your connection and try again.`,
            $localize`:Dismisses a message:OK`,
          );
        },
      });
  }

  /**
   * Opens the Task's details to change them. The dialog loads on first use: it brings the date
   * picker and date-fns, which listing Tasks doesn't need.
   */
  protected async edit(task: Task): Promise<void> {
    const todoListId = this.todoListId();
    const { TaskDetailsDialog } = await import('./task-details-dialog');
    if (this.destroyed) return;
    // The version the changes are based on
    let latest = task;
    this.dialogs
      .open<TaskDetailsDialog, TaskDetailsDialogData, Task>(TaskDetailsDialog, {
        data: {
          task,
          save: (details) =>
            this.api.updateTask(todoListId, task.id, { ...details, version: latest.version }),
          reload: () =>
            this.api.getTask(todoListId, task.id).pipe(
              tap((read) => {
                latest = read;
                this.replace(read);
              }),
            ),
        },
      })
      .afterClosed()
      .subscribe((changed) => {
        if (!changed) return;
        // Changed details may change whether the Task matches, or where it sorts
        if (this.filtered()) this.main.reload();
        else this.replace(changed);
      });
  }

  protected editLabel(task: Task): string {
    return $localize`:Button that opens a Task's details to change them, naming the Task by its title:Edit “${task.title}:title:”`;
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
    this.changeEverywhere((tasks) => tasks.filter((task) => task.id !== id));
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

  /** Shows the Tasks of another view: other filters, sort, search or page. */
  protected show(view: TaskView): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: queryParamsOf(view) });
  }

  protected goToPage(page: number): void {
    this.show({ ...this.view(), page });
  }

  private query(todoListId: number, view: TaskView, completed: boolean): Observable<TaskPage> {
    // Only the parameters that differ from the backend's defaults
    return this.api.getTasks(
      todoListId,
      view.page,
      PAGE_SIZE,
      view.sort === TaskSort.POSITION ? undefined : view.sort,
      completed,
      view.priorities.length ? view.priorities : undefined,
      view.dueFrom,
      view.dueTo,
      view.overdueOnly || undefined,
      view.search || undefined,
    );
  }

  private shownIn(list: ResourceRef<TaskPage | undefined>): Task[] | undefined {
    if (!list.hasValue()) return undefined;
    const pending = this.pendingDeletes();
    return list.value().items.filter((task) => !pending.has(task.id));
  }

  /** How many Tasks match in all, apart from those deleted from the page shown. */
  private countIn(list: ResourceRef<TaskPage | undefined>, shown: Task[]): number | undefined {
    const page = list.value();
    return page && page.totalItems - (page.items.length - shown.length);
  }

  /** Takes the Task out of the list; what's returned puts it back where it was. */
  private takeOut(list: ResourceRef<TaskPage | undefined>, task: Task): () => void {
    const index = list.value()?.items.findIndex((each) => each.id === task.id) ?? -1;
    this.changeIn(list, (tasks) => tasks.filter((each) => each.id !== task.id));
    return () =>
      this.changeIn(list, (tasks) =>
        tasks.some((each) => each.id === task.id)
          ? tasks
          : [...tasks.slice(0, index), task, ...tasks.slice(index)],
      );
  }

  private replace(task: Task): void {
    this.changeEverywhere((tasks) => tasks.map((each) => (each.id === task.id ? task : each)));
  }

  private changeEverywhere(apply: (tasks: Task[]) => Task[]): void {
    this.changeIn(this.main, apply);
    this.changeIn(this.completedSection, apply);
  }

  /** Changes the Tasks of a list, counting any it gains or loses among those that match. */
  private changeIn(list: ResourceRef<TaskPage | undefined>, apply: (tasks: Task[]) => Task[]) {
    if (!list.hasValue()) return;
    const page = list.value();
    const items = apply(page.items);
    list.set({ ...page, items, totalItems: page.totalItems + items.length - page.items.length });
  }
}

/** The Tasks, with one moved to just before or just after another. */
function placed(tasks: Task[], task: Task, placement: Placement, relativeTo: Task): Task[] {
  const others = tasks.filter((each) => each.id !== task.id);
  const at =
    others.findIndex((each) => each.id === relativeTo.id) + (placement === Placement.AFTER ? 1 : 0);
  return [...others.slice(0, at), task, ...others.slice(at)];
}
