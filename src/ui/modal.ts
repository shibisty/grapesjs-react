/**
 * Export dialog inside the GrapesJS modal: one block per file (name, Copy,
 * Download, read-only code) plus the export notes. Built with DOM APIs and
 * textContent only — generated code is never interpreted as HTML.
 */
import type { Editor } from 'grapesjs';
import type { ExportFile, JsxExportResult } from '../types';
import { isRtlLocale, type Translate } from '../i18n';
import { copyText, downloadFile } from './files';

const COPIED_MS = 1500;

function button(doc: Document, text: string, action: string): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'gjs-ejsx-btn';
  b.dataset.action = action;
  b.textContent = text;
  return b;
}

function fileBlock(doc: Document, file: ExportFile, t: Translate): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = `gjs-ejsx-file gjs-ejsx-file--${file.name.split('.').pop()}`;
  wrap.dataset.file = file.name;

  const head = doc.createElement('div');
  head.className = 'gjs-ejsx-head';
  const name = doc.createElement('span');
  name.className = 'gjs-ejsx-name';
  name.textContent = file.name;
  name.title = file.name;

  const code = doc.createElement('textarea');
  code.className = 'gjs-ejsx-code';
  code.readOnly = true;
  code.spellcheck = false;
  code.wrap = 'off';
  code.dir = 'ltr'; // code stays LTR in RTL interfaces
  code.value = file.content;
  code.setAttribute('aria-label', file.name);

  const copy = button(doc, t('copy'), 'copy');
  let timer: ReturnType<typeof setTimeout> | undefined;
  copy.addEventListener('click', async () => {
    const ok = await copyText(file.content, code);
    if (!ok) return;
    copy.textContent = t('copied');
    copy.classList.add('gjs-ejsx-btn--done');
    clearTimeout(timer);
    timer = setTimeout(() => {
      copy.textContent = t('copy');
      copy.classList.remove('gjs-ejsx-btn--done');
    }, COPIED_MS);
  });

  const download = button(doc, t('download'), 'download');
  download.addEventListener('click', () => downloadFile(file, doc));

  head.append(name, copy, download);
  wrap.append(head, code);
  return wrap;
}

export function buildDialog(doc: Document, result: JsxExportResult, t: Translate, locale?: string): HTMLElement {
  const root = doc.createElement('div');
  root.className = 'gjs-ejsx';
  if (isRtlLocale(locale)) root.dir = 'rtl';

  if (result.warnings.length) {
    const notes = doc.createElement('details');
    notes.className = 'gjs-ejsx-notes';
    const summary = doc.createElement('summary');
    summary.textContent = `${t('warnings')} (${result.warnings.length})`;
    const list = doc.createElement('ul');
    result.warnings.forEach((w) => {
      const li = doc.createElement('li');
      li.textContent = w;
      list.appendChild(li);
    });
    notes.append(summary, list);
    root.appendChild(notes);
  }

  result.files.forEach((f) => root.appendChild(fileBlock(doc, f, t)));
  return root;
}

export function openDialog(editor: Editor, result: JsxExportResult, t: Translate): HTMLElement {
  const locale = (() => {
    try {
      return editor.I18n?.getLocale?.();
    } catch {
      return undefined;
    }
  })();
  const content = buildDialog(document, result, t, locale);
  editor.Modal.open({ title: t('modalTitle'), content, attributes: { class: 'gjs-ejsx-modal' } });
  return content;
}
