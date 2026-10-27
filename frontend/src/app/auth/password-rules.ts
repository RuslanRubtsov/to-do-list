import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The password strength rules the backend enforces (see `RegisterRequest.password` in the OpenAPI
 * spec), checked here too so the form can show them being met as the User types.
 */
export const PASSWORD_MIN_LENGTH = 8;
/** BCrypt hashes at most 72 bytes of UTF-8, so the backend refuses longer passwords. */
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordRules {
  longEnough: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  notTooLong: boolean;
}

export function checkPasswordRules(password: string): PasswordRules {
  return {
    longEnough: [...password].length >= PASSWORD_MIN_LENGTH,
    hasLetter: /\p{L}/u.test(password),
    hasDigit: /\p{N}/u.test(password),
    notTooLong: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
  };
}

/** Fails with `{ passwordRules: PasswordRules }` while any rule is broken. */
export const passwordRulesValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const rules = checkPasswordRules(control.value ?? '');
  return Object.values(rules).every(Boolean) ? null : { passwordRules: rules };
};
