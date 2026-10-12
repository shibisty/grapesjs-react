import type { Editor } from 'grapesjs';
import type { ExportJsxLabels } from '../types';

import ar from './locales/ar';
import bs from './locales/bs';
import ca from './locales/ca';
import de from './locales/de';
import el from './locales/el';
import en from './locales/en';
import es from './locales/es';
import fa from './locales/fa';
import fr from './locales/fr';
import he from './locales/he';
import id from './locales/id';
import it from './locales/it';
import ko from './locales/ko';
import nb from './locales/nb';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import ru from './locales/ru';
import se from './locales/se';
import tr from './locales/tr';
import uk from './locales/uk';
import vi from './locales/vi';
import zh from './locales/zh';

/** i18n namespace inside `editor.I18n`: keys are `exportJsx.<label>`. */
export const I18N_NS = 'exportJsx';

/**
 * The same language codes as `grapesjs/locale` (ar, bs, ca, de, el, en, es,
 * fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, vi, zh) plus `uk` —
 * the same set as grapesjs-context-menu. `se` is Swedish (the core's
 * historical code).
 */
export const locales: Record<string, ExportJsxLabels> = {
  ar,
  bs,
  ca,
  de,
  el,
  en,
  es,
  fa,
  fr,
  he,
  id,
  it,
  ko,
  nb,
  nl,
  pl,
  pt,
  ru,
  se,
  tr,
  uk,
  vi,
  zh,
};

export const SUPPORTED_LOCALES: readonly string[] = Object.keys(locales);

/**
 * Registers every built-in locale in `editor.I18n` under `exportJsx`.
 * `addMessages()` merges, so messages from the site config survive; to
 * override a phrase call `editor.I18n.addMessages()` after the plugin is
 * loaded, or use the `labels` option.
 */
export function registerMessages(editor: Editor): void {
  const i18n = editor.I18n;
  if (!i18n || typeof i18n.addMessages !== 'function') return;
  const messages: Record<string, Record<string, ExportJsxLabels>> = {};
  SUPPORTED_LOCALES.forEach((lang) => {
    messages[lang] = { [I18N_NS]: { ...locales[lang] } };
  });
  i18n.addMessages(messages);
}

export type Translate = (key: keyof ExportJsxLabels) => string;

/**
 * Label lookup order: explicit `labels` option -> `editor.I18n` (current
 * locale, then the editor's fallback locale) -> built-in English.
 */
export function createTranslator(editor: Editor, overrides: Partial<ExportJsxLabels> = {}): Translate {
  return (key) => {
    const own = overrides[key];
    if (typeof own === 'string' && own) return own;
    let msg: unknown;
    try {
      msg = editor.I18n?.t(`${I18N_NS}.${key}`);
    } catch {
      msg = undefined;
    }
    return typeof msg === 'string' && msg ? msg : en[key];
  };
}

/** RTL languages among the supported ones. */
export const isRtlLocale = (locale: string | undefined): boolean => /^(ar|he|fa)\b/i.test(locale ?? '');
