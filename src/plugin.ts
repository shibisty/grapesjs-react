import type { Editor } from 'grapesjs';
import { exportPage } from './export';
import { createTranslator, registerMessages, type Translate } from './i18n';
import { openDialog } from './ui/modal';
import { downloadFile } from './ui/files';
import { injectStyles } from './ui/styles';
import type { ExportCallOptions, ExportJsxPluginOptions, JsxExportResult, JsxOptions } from './types';

/** Command ids. */
export const COMMANDS = {
  /** Returns `JsxExportResult` (`editor.runCommand('export-jsx', { pageId })`). */
  export: 'export-jsx',
  /** Opens the export dialog. */
  open: 'export-jsx:open',
  /** Downloads `<Name>.jsx` and `<Name>.css` right away. */
  download: 'export-jsx:download',
} as const;

/** Editor events. */
export const EVENTS = {
  /** After every export, with the `JsxExportResult` (e.g. to save it on a server). */
  export: 'export-jsx:export',
} as const;

const BUTTON_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8,3A2,2 0 0,0 6,5V9A2,2 0 0,1 4,11H3V13H4A2,2 0 0,1 6,15V19A2,2 0 0,0 8,21H10V19H8V14A2,2 0 0,0 6,12A2,2 0 0,0 8,10V5H10V3M16,3A2,2 0 0,1 18,5V9A2,2 0 0,0 20,11H21V13H20A2,2 0 0,0 18,15V19A2,2 0 0,1 16,21H14V19H16V14A2,2 0 0,1 18,12A2,2 0 0,1 16,10V5H14V3H16Z"/></svg>';

interface PluginState {
  options: Partial<JsxOptions>;
  t: Translate;
}

const states = new WeakMap<Editor, PluginState>();

/**
 * Exports a page of an editor that has the plugin, using the plugin
 * options merged with `options`.
 */
export function getJsx(editor: Editor, options: ExportCallOptions = {}): JsxExportResult {
  const state = states.get(editor);
  const result = exportPage(editor, state?.options ?? {}, options);
  editor.trigger(EVENTS.export, result);
  return result;
}

type ButtonModel = { set(key: string, value: unknown): void };

function addButton(editor: Editor, opts: ExportJsxPluginOptions['button'], t: Translate): void {
  if (opts === false) return;
  const cfg = typeof opts === 'object' && opts ? opts : {};
  const panelId = cfg.panel || 'options';
  const id = cfg.id || COMMANDS.export;
  const panel = editor.Panels.getPanel(panelId);
  if (!panel) return;
  if (editor.Panels.getButton(panelId, id)) return;
  const btn = editor.Panels.addButton(panelId, {
    id,
    command: COMMANDS.open,
    label: BUTTON_ICON,
    attributes: { title: t('buttonTitle'), 'aria-label': t('buttonTitle') },
    togglable: false,
  } as Parameters<Editor['Panels']['addButton']>[1]);

  // GrapesJS 0.21 emits `i18n:locale` before it stores the new locale:
  // update after the current call stack.
  const relabel = () =>
    Promise.resolve().then(() => {
      (btn as unknown as ButtonModel | null)?.set('attributes', { title: t('buttonTitle'), 'aria-label': t('buttonTitle') });
    });
  editor.on('i18n:locale i18n:update', relabel);
}

/**
 * GrapesJS plugin: export the page as a React component (JSX + CSS).
 */
export default function exportJsxPlugin(editor: Editor, options: ExportJsxPluginOptions = {}): void {
  const { button = true, labels = {}, injectCss = true, extendEditor = true, ...jsxOptions } = options ?? {};

  registerMessages(editor);
  const t = createTranslator(editor, labels);
  states.set(editor, { options: jsxOptions, t });

  const cmds = editor.Commands;
  cmds.add(COMMANDS.export, {
    run: (ed: Editor, _sender: unknown, opts: ExportCallOptions = {}) => getJsx(ed, opts),
  });
  cmds.add(COMMANDS.open, {
    run: (ed: Editor, sender: ButtonModel | undefined, opts: ExportCallOptions = {}) => {
      // A panel button stays "active" after its command runs; this is a one-shot action.
      sender?.set?.('active', false);
      if (injectCss) injectStyles(document);
      const result = getJsx(ed, opts);
      openDialog(ed, result, t);
      return result;
    },
  });
  cmds.add(COMMANDS.download, {
    run: (ed: Editor, _sender: unknown, opts: ExportCallOptions = {}) => {
      const result = getJsx(ed, opts);
      result.files.forEach((f) => downloadFile(f));
      return result;
    },
  });

  if (extendEditor) {
    // Kept from the original plugin: editor.getJsx({ pageId, componentName, … }).
    (editor as Editor & { getJsx?: (o?: ExportCallOptions) => JsxExportResult }).getJsx = (o) => getJsx(editor, o);
  }

  // Panels may be filled by plugins loaded after this one (presets).
  editor.onReady(() => addButton(editor, button, t));
}
