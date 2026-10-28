import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Priority, Task, TaskDetails } from '@api';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Observable } from 'rxjs';
import { isUnreachable, problemOf, showFieldErrors } from '../http/problems';
import { provideLocaleDates } from '../i18n/dates';
import { TASK_TITLE_MAX_LENGTH, taskTitleValidators } from './task-title';

/** The longest description the backend accepts (`TaskDetails.description` in the OpenAPI spec). */
const DESCRIPTION_MAX_LENGTH = 2000;

export interface TaskDetailsDialogData {
  task: Task;
  /** Sends the details to the backend. */
  save: (details: TaskDetails) => Observable<Task>;
}

/** Changes a Task's details. Closes with the changed Task once the backend has it. */
@Component({
  selector: 'app-task-details-dialog',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  // Here rather than app-wide, so date-fns loads only with the pages that pick dates
  providers: [provideLocaleDates()],
  templateUrl: './task-details-dialog.html',
  styleUrl: './task-details-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailsDialog {
  private readonly data = inject<TaskDetailsDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject<MatDialogRef<TaskDetailsDialog, Task>>(MatDialogRef);
  private readonly dates = inject<DateAdapter<Date>>(DateAdapter);

  protected readonly titleMaxLength = TASK_TITLE_MAX_LENGTH;
  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  protected readonly priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH];
  /** A date written the way the date field reads them, as an example. */
  protected readonly exampleDate = this.dates.format(
    new Date(2026, 11, 31),
    inject(MAT_DATE_FORMATS).display.dateInput,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: [this.data.task.title, taskTitleValidators],
    description: [this.data.task.description ?? '', Validators.maxLength(DESCRIPTION_MAX_LENGTH)],
    dueDate: [this.data.task.dueDate ? parseISO(this.data.task.dueDate) : (null as Date | null)],
    priority: [this.data.task.priority],
  });
  protected readonly saving = signal(false);
  protected readonly failure = signal<'unreachable' | 'unexpected' | null>(null);

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const { title, description, dueDate, priority } = this.form.getRawValue();
    this.saving.set(true);
    this.failure.set(null);
    this.data
      .save({
        title: title.trim(),
        description: description.trim() || null,
        // The date as picked, without the time zone a Date carries
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        priority,
      })
      .subscribe({
        next: (saved) => this.dialog.close(saved),
        error: (error: unknown) => {
          this.saving.set(false);
          if (!showFieldErrors(this.form, problemOf(error))) {
            this.failure.set(isUnreachable(error) ? 'unreachable' : 'unexpected');
          }
        },
      });
  }
}
