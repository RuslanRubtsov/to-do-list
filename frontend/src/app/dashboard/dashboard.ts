import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { DashboardCounts, DashboardService, DashboardTask, TasksService, TodoListRole } from '@api';
import { isNotFound, isUnreachable } from '../http/problems';
import { RelativeDatePipe } from '../tasks/relative-date.pipe';
import { TodoLists } from '../todo-lists/todo-lists';

/** The sections of the dashboard, each a list of open Tasks. */
type Section = 'overdue' | 'dueToday' | 'upcoming';

/**
 * What needs attention across every Todo List the User can access: counts, then the open Tasks
 * Overdue, due today and due in the next 7 days. Owners and Editors complete them in place.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgTemplateOutlet,
    RelativeDatePipe,
    RouterLink,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardView {
  private readonly api = inject(DashboardService);
  private readonly tasksApi = inject(TasksService);
  private readonly todoLists = inject(TodoLists);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly dashboard = rxResource({ stream: () => this.api.getDashboard() });
  protected readonly unreachable = computed(() => isUnreachable(this.dashboard.error()));
  /** Whether any section has a Task in it. */
  protected readonly anythingDue = computed(() => {
    const dashboard = this.dashboard.value();
    return !!dashboard && SECTIONS.some((section) => dashboard[section].length > 0);
  });

  protected canComplete(task: DashboardTask): boolean {
    return task.todoList.role !== TodoListRole.VIEWER;
  }

  /**
   * Takes the Task off the dashboard at once and counts it as Completed; a failure puts it back
   * and says so, unless the Task or its Todo List is gone. Once done, the drawer counts one open
   * Task fewer in its Todo List.
   */
  protected complete(section: Section, task: DashboardTask): void {
    const place = this.dashboard.value()?.[section].indexOf(task) ?? -1;
    if (place < 0) return;
    this.dashboard.update(
      (dashboard) =>
        dashboard && {
          ...dashboard,
          [section]: dashboard[section].filter((each) => each !== task),
          counts: counted(dashboard.counts, section, 1),
        },
    );
    this.tasksApi.completeTask(task.todoList.id, task.task.id).subscribe({
      next: () => this.todoLists.countCompleted(task.todoList.id),
      error: (error: unknown) => {
        // Gone, or no longer the User's to reach: the dashboard as it is now shows what's left
        if (isNotFound(error)) {
          this.dashboard.reload();
          return;
        }
        this.dashboard.update(
          (dashboard) =>
            dashboard && {
              ...dashboard,
              [section]: [
                ...dashboard[section].slice(0, place),
                task,
                ...dashboard[section].slice(place),
              ],
              counts: counted(dashboard.counts, section, -1),
            },
        );
        this.snackBar.open(
          $localize`:Message when completing a Task, or taking that back, fails:Couldn’t change “${task.task.title}:title:”. Check your connection and try again.`,
          $localize`:Dismisses a message:OK`,
        );
      },
    });
  }
}

const SECTIONS: readonly Section[] = ['overdue', 'dueToday', 'upcoming'];

/** The counts once this many Tasks of the section are Completed; a negative number undoes that. */
function counted(counts: DashboardCounts, section: Section, completed: number): DashboardCounts {
  return {
    open: counts.open - completed,
    overdue: counts.overdue - (section === 'overdue' ? completed : 0),
    dueToday: counts.dueToday - (section === 'dueToday' ? completed : 0),
    completedThisWeek: counts.completedThisWeek + completed,
  };
}
