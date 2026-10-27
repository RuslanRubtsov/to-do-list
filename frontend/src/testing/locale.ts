import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { clearTranslations, loadTranslations } from '@angular/localize';
import { Xliff2TranslationParser } from '@angular/localize/tools';
import { readFileSync } from 'node:fs';

/** The source locale, English, plus the locale data of every translation. */
const LOCALE_DATA = { en: null, uk: localeUk };

export type Locale = keyof typeof LOCALE_DATA;

/**
 * Switches `$localize` to a locale's translations, read from the same XLIFF file the production
 * build compiles in (ADR-0002). Tests can't use the compile-time translation the build does, so
 * this loads them at runtime instead. English is the source locale and needs no translations.
 */
export function useLocale(locale: Locale): void {
  clearTranslations();
  const localeData = LOCALE_DATA[locale];
  if (!localeData) return;

  registerLocaleData(localeData, locale);
  loadTranslations(readTranslations(`src/locale/messages.${locale}.xlf`));
}

function readTranslations(path: string): Record<string, string> {
  const contents = readFileSync(path, 'utf8');
  const parser = new Xliff2TranslationParser();
  const analysis = parser.analyze(path, contents);
  if (!analysis.canParse) {
    throw new Error(`${path} is not an XLIFF 2.0 translation file`);
  }
  const { translations } = parser.parse(path, contents, analysis.hint);
  return Object.fromEntries(
    Object.entries(translations).map(([id, translation]) => [id, translation.text]),
  );
}
