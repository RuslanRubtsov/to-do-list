import { Validators } from '@angular/forms';
import { notBlank } from '../forms/not-blank';

/** The longest Todo List name the backend accepts (`TodoListDraft.name` in the OpenAPI spec). */
export const TODO_LIST_NAME_MAX_LENGTH = 100;

/** A Todo List name the backend accepts: not blank and not too long. */
export const todoListNameValidators = [notBlank, Validators.maxLength(TODO_LIST_NAME_MAX_LENGTH)];
