# Compile-time i18n with @angular/localize

The frontend supports English and Ukrainian using Angular's built-in `@angular/localize`: translations are compiled into one build per locale, served side by side (`/en/`, `/uk/`), and switching language reloads the app into the other build. We chose this over a runtime library such as Transloco for zero runtime translation cost, first-party tooling (`ng extract-i18n`, XLIFF, ICU plurals for Ukrainian), and because it is the approach Angular itself recommends.

## Consequences

- Every user-facing string is marked with `i18n` / `$localize` and extracted to XLIFF; a CI check fails when a Ukrainian translation is missing.
- The web server must serve both locale builds and redirect `/` to the User's preferred language.
- The API never returns translated text, only stable error codes the frontend translates.
