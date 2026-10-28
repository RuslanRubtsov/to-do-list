import { Validators } from '@angular/forms';
import { notBlank } from '../forms/not-blank';

/** The longest Task title the backend accepts (`TaskDraft.title` and `TaskDetails.title` in the OpenAPI spec). */
export const TASK_TITLE_MAX_LENGTH = 200;

/** What the backend requires of a Task's title. */
export const taskTitleValidators = [notBlank, Validators.maxLength(TASK_TITLE_MAX_LENGTH)];
