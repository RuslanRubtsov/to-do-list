import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

/** The longest display name the backend accepts (`displayName` in the OpenAPI spec). */
export const DISPLAY_NAME_MAX_LENGTH = 100;

/** A display name the backend accepts: not blank, which only spaces would be, and not too long. */
export const displayNameValidators = [
  (control: AbstractControl<string>): ValidationErrors | null =>
    control.value?.trim() ? null : { required: true },
  Validators.maxLength(DISPLAY_NAME_MAX_LENGTH),
];
