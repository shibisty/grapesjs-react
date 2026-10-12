/** Editor-level export: a page -> { jsx, css, files, warnings }. */
import type { Component, Editor } from 'grapesjs';
import { convertComponent } from './convert';
import { cssImportPath, resolveJsxOptions } from './options';
import { formatCss } from './core/css';
import type { ExportCallOptions, ExportFile, JsxExportResult, JsxOptions } from './types';

interface PageLike {
  getMainComponent(): Component;
  getName?(): string;
}

function findPage(editor: Editor, pageId?: string): PageLike | null {
  const pages = (editor as unknown as { Pages?: { get(id: string): PageLike | undefined; getSelected(): PageLike | undefined } }).Pages;
  if (!pages) return null;
  if (pageId) {
    const page = pages.get(pageId);
    if (!page) throw new Error(`export-jsx: no page with id "${pageId}"`);
    return page;
  }
  return pages.getSelected() ?? null;
}

export function exportPage(editor: Editor, pluginOptions: Partial<JsxOptions>, call: ExportCallOptions = {}): JsxExportResult {
  const { pageId, cssOptions, ...jsxCall } = call;
  const page = findPage(editor, pageId);
  const root = page?.getMainComponent() ?? editor.getWrapper();
  if (!root) throw new Error('export-jsx: the editor has no content yet');

  const opts = resolveJsxOptions(pluginOptions, jsxCall);
  const result = convertComponent(root, opts);

  let css = '';
  try {
    css = editor.getCss({ ...(cssOptions ?? {}), component: root } as Parameters<Editor['getCss']>[0]) ?? '';
  } catch {
    css = editor.getCss() ?? '';
  }

  if (opts.prettyCss && css) css = formatCss(css, opts.indent);

  const files: ExportFile[] = [{ name: `${result.componentName}.jsx`, content: result.jsx, mime: 'text/javascript' }];
  if (css.trim()) {
    const imported = cssImportPath(opts, result.componentName);
    const cssName = imported ? imported.split('/').pop() || `${result.componentName}.css` : `${result.componentName}.css`;
    files.push({ name: cssName, content: css, mime: 'text/css' });
  }

  return { jsx: result.jsx, css, warnings: result.warnings, files, componentName: result.componentName };
}
