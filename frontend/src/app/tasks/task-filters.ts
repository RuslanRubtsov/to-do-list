import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Priority, TaskSort } from '@api';
import { DEFAULT_VIEW, isFiltered, TaskView } from './task-view';

/**
 * The search, filters and sort for a Todo List's Tasks. Shows a view and asks for others; any
 * change starts again from the first page.
 */
@Component({
  selector: 'app-task-filters',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './task-filters.html',
  styleUrl: './task-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFilters {
  readonly view = input.required<TaskView>();
  readonly viewChange = output<TaskView>();

  protected readonly filtered = computed(() => isFiltered(this.view()));
  protected readonly priorities = [Priority.HIGH, Priority.MEDIUM, Priority.LOW];
  protected readonly sorts = [
    TaskSort.POSITION,
    TaskSort.DUE_DATE,
    TaskSort.PRIORITY,
    TaskSort.TITLE,
    TaskSort.CREATED,
  ];

  protected change(changes: Partial<TaskView>): void {
    this.viewChange.emit({ ...this.view(), ...changes, page: 0 });
  }

  protected showing(show: 'all' | 'open' | 'completed'): void {
    this.change({ show: show === 'all' ? undefined : show });
  }

  /** A date field's date, `2026-11-03`; none when it's empty or holds no whole date yet. */
  protected dateIn(event: Event): string | undefined {
    return (event.target as HTMLInputElement).value || undefined;
  }

  protected clear(): void {
    this.viewChange.emit(DEFAULT_VIEW);
  }
}
