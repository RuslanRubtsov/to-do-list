import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Like `Validators.required`, but also refuses text of only spaces, as the backend's `.*\S.*`
 * patterns do. Reports `{ required: true }`, so forms show the same message for both.
 */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}
