import { Validators } from '@angular/forms';
import { notBlank } from '../forms/not-blank';

/** The longest display name the backend accepts (`displayName` in the OpenAPI spec). */
export const DISPLAY_NAME_MAX_LENGTH = 100;

/** A display name the backend accepts: not blank, which only spaces would be, and not too long. */
export const displayNameValidators = [notBlank, Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)];
