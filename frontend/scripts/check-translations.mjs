// Fails when any message extracted from the source (src/locale/messages.xlf, written by
// `ng extract-i18n`) has no translation in a locale's file. The production build already fails on
// messages missing from a translation file, but a unit present without a <target> silently falls
// back to English, and that is how newly merged messages arrive.
import { readFileSync } from 'node:fs';

const SOURCE = 'src/locale/messages.xlf';
const LOCALES = ['uk'];

const sourceIds = [...units(SOURCE).keys()];

let missing = 0;
for (const locale of LOCALES) {
  const path = `src/locale/messages.${locale}.xlf`;
  const translations = units(path);
  for (const id of sourceIds) {
    const target = translations.get(id)?.match(/<target>([\s\S]*?)<\/target>/)?.[1];
    if (!target?.trim()) {
      console.error(`${path}: no ${locale} translation for message ${id}`);
      missing++;
    }
  }
}

if (missing > 0) {
  console.error(
    `${missing} missing translation(s). Translate them in src/locale/messages.<locale>.xlf.`,
  );
  process.exit(1);
}
console.log(`All ${sourceIds.length} messages are translated into ${LOCALES.join(', ')}.`);

/** XLIFF 2.0 units by id, each as its raw XML. */
function units(path) {
  const xliff = readFileSync(path, 'utf8');
  return new Map(
    [...xliff.matchAll(/<unit id="([^"]+)">([\s\S]*?)<\/unit>/g)].map(([, id, body]) => [id, body]),
  );
}
