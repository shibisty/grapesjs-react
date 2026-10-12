import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import { createTranslator, locales, registerMessages, SUPPORTED_LOCALES, isRtlLocale } from '../src/i18n';
import en from '../src/i18n/locales/en';
import ru from '../src/i18n/locales/ru';
import uk from '../src/i18n/locales/uk';
import { createEditor, destroyEditor } from './helpers/editor';

describe('built-in locales', () => {
  it('every locale has exactly the English keys, all non-empty', () => {
    const keys = Object.keys(en).sort();
    Object.entries(locales).forEach(([lang, msgs]) => {
      expect(Object.keys(msgs).sort(), lang).toEqual(keys);
      Object.values(msgs).forEach((v) => expect(typeof v === 'string' && v.trim().length > 0, lang).toBe(true));
    });
  });

  it('covers every locale shipped with GrapesJS core, plus uk', () => {
    const core = ['ar', 'bs', 'ca', 'de', 'el', 'en', 'es', 'fa', 'fr', 'he', 'id', 'it',
      'ko', 'nb', 'nl', 'pl', 'pt', 'ru', 'se', 'tr', 'vi', 'zh'];
    expect([...SUPPORTED_LOCALES].sort()).toEqual([...core, 'uk'].sort());
  });

  it('every non-English locale is actually translated', () => {
    Object.entries(locales)
      .filter(([lang]) => lang !== 'en')
      .forEach(([lang, msgs]) => {
        const same = (Object.keys(en) as (keyof typeof en)[]).filter((k) => msgs[k] === en[k]);
        expect(same, lang).toEqual([]);
      });
  });

  it('labels are single-line and not padded', () => {
    Object.entries(locales).forEach(([lang, msgs]) => {
      Object.values(msgs).forEach((v) => {
        expect(v, lang).toBe(v.trim());
        expect(/[\n\r]/.test(v), lang).toBe(false);
      });
    });
  });

  it('isRtlLocale', () => {
    expect(['ar', 'he', 'fa', 'ar-EG'].every(isRtlLocale)).toBe(true);
    expect(['en', 'ru', undefined].some((l) => isRtlLocale(l))).toBe(false);
  });
});

describe('editor integration', () => {
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  it('registers every locale in editor.I18n', async () => {
    editor = await createEditor();
    registerMessages(editor);
    SUPPORTED_LOCALES.forEach((l) => {
      expect(editor.I18n.t('exportJsx.copy', { l }), l).toBe(locales[l].copy);
    });
  });

  it('translator: editor locale, English fallback, explicit labels, host overrides', async () => {
    editor = await createEditor();
    registerMessages(editor);
    const t = createTranslator(editor, { download: 'Save' });
    editor.I18n.setLocale('ru');
    expect(t('copy')).toBe(ru.copy);
    expect(t('download')).toBe('Save');
    editor.I18n.setLocale('uk');
    expect(t('copy')).toBe(uk.copy);
    editor.I18n.setLocale('xx');
    expect(t('copy')).toBe(en.copy);
    editor.I18n.setLocale('ru');
    editor.I18n.addMessages({ ru: { exportJsx: { copy: 'Скопировать код' } } });
    expect(t('copy')).toBe('Скопировать код');
  });
});
