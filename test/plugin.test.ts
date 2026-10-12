import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'grapesjs';
import exportJsx, { COMMANDS, EVENTS, getJsx } from '../src/index';
import type { ExportJsxPluginOptions, JsxExportResult } from '../src/types';
import { STYLE_ID } from '../src/ui/styles';
import { createEditor, destroyEditor } from './helpers/editor';
import ru from '../src/i18n/locales/ru';

let editor: Editor;
afterEach(() => destroyEditor(editor));

const setup = (opts: ExportJsxPluginOptions = {}, components = '<p class="x">Hello <b>you</b></p>', config = {}) =>
  createEditor({ components, style: '.x{color:red}', plugins: [(ed) => exportJsx(ed, opts)], config });

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('API', () => {
  it('export-jsx command returns the result (compatible with the original { jsx, css })', async () => {
    editor = await setup({ componentName: 'Home' });
    const r = editor.runCommand(COMMANDS.export) as JsxExportResult;
    expect(r.jsx).toContain('export default function Home()');
    expect(r.jsx).toContain('<p className="x">Hello <b>you</b></p>');
    expect(r.css).toContain('.x {\n  color: red;\n}');
    expect(r.files.map((f) => f.name)).toEqual(['Home.jsx', 'Home.css']);
  });

  it('call options override plugin options', async () => {
    editor = await setup({ componentName: 'Home', reactImport: true });
    const r = editor.runCommand(COMMANDS.export, { componentName: 'Other', reactImport: false }) as JsxExportResult;
    expect(r.jsx.startsWith('export default function Other()')).toBe(true);
  });

  it('editor.getJsx() is kept for compatibility, and can be turned off', async () => {
    editor = await setup();
    expect((editor as unknown as { getJsx(): JsxExportResult }).getJsx().jsx).toContain('Hello');
    await destroyEditor(editor);
    editor = await setup({ extendEditor: false });
    expect((editor as unknown as { getJsx?: unknown }).getJsx).toBeUndefined();
  });

  it('getJsx(editor) uses the plugin options and emits the export event', async () => {
    editor = await setup({ componentName: 'Land' });
    const seen: JsxExportResult[] = [];
    editor.on(EVENTS.export, (r: JsxExportResult) => seen.push(r));
    const r = getJsx(editor);
    expect(r.componentName).toBe('Land');
    expect(seen).toEqual([r]);
  });
});

describe('panel button', () => {
  it('is added to the options panel with a translated title', async () => {
    editor = await setup();
    const btn = editor.Panels.getButton('options', 'export-jsx');
    expect(btn).toBeTruthy();
    expect(btn!.get('command')).toBe(COMMANDS.open);
    expect(btn!.get('attributes').title).toBe('Export as React (JSX)');
  });

  it('title follows the editor locale', async () => {
    editor = await setup();
    editor.I18n.setLocale('ru');
    await tick();
    expect(editor.Panels.getButton('options', 'export-jsx')!.get('attributes').title).toBe(ru.buttonTitle);
  });

  it('button: false adds nothing; a missing panel is ignored', async () => {
    editor = await setup({ button: false });
    expect(editor.Panels.getButton('options', 'export-jsx')).toBeFalsy();
    await destroyEditor(editor);
    editor = await setup({ button: { panel: 'nope' } });
    expect(editor.Panels.getButton('options', 'export-jsx')).toBeFalsy();
  });

  it('custom id and panel', async () => {
    editor = await setup({ button: { panel: 'views', id: 'jsx' } });
    expect(editor.Panels.getButton('views', 'jsx')).toBeTruthy();
  });
});

describe('export dialog', () => {
  let created: Blob[];
  let clicked: string[];

  beforeEach(() => {
    created = [];
    clicked = [];
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
      created.push(b);
      return `blob:${created.length}`;
    };
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
  });

  const dialog = () => document.querySelector<HTMLElement>('.gjs-ejsx')!;

  it('opens the modal with one block per file', async () => {
    editor = await setup({ componentName: 'Home' });
    editor.runCommand(COMMANDS.open);
    expect(editor.Modal.isOpen()).toBe(true);
    const blocks = dialog().querySelectorAll<HTMLElement>('.gjs-ejsx-file');
    expect([...blocks].map((b) => b.dataset.file)).toEqual(['Home.jsx', 'Home.css']);
    const code = blocks[0].querySelector('textarea')!;
    expect(code.readOnly).toBe(true);
    expect(code.value).toContain('export default function Home()');
    expect(document.getElementById(STYLE_ID)).toBeTruthy();
  });

  it('modal title is translated', async () => {
    editor = await setup();
    editor.I18n.setLocale('ru');
    editor.runCommand(COMMANDS.open);
    expect(document.querySelector('.gjs-mdl-title')!.textContent).toBe(ru.modalTitle);
  });

  it('copy button writes to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    editor = await setup();
    editor.runCommand(COMMANDS.open);
    const copy = dialog().querySelector<HTMLButtonElement>('[data-file="Page.jsx"] [data-action="copy"]')!;
    copy.click();
    await tick();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('export default function Page()'));
    expect(copy.textContent).toBe('Copied');
  });

  it('download button saves the file', async () => {
    editor = await setup();
    editor.runCommand(COMMANDS.open);
    dialog().querySelector<HTMLButtonElement>('[data-file="Page.css"] [data-action="download"]')!.click();
    expect(clicked).toEqual(['Page.css']);
    const text = await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.readAsText(created[0]);
    });
    expect(text).toContain('color: red;');
    expect(created[0].type).toBe('text/css;charset=utf-8');
  });

  it('export-jsx:download saves every file', async () => {
    editor = await setup();
    editor.runCommand(COMMANDS.download);
    expect(clicked).toEqual(['Page.jsx', 'Page.css']);
  });

  it('shows export notes when something was not carried over', async () => {
    editor = await setup({
      handlers: {
        text: (_c, ctx) => {
          ctx.warn('<b>not html</b>');
          return null;
        },
      },
    });
    editor.runCommand(COMMANDS.open);
    const notes = dialog().querySelector('.gjs-ejsx-notes')!;
    expect(notes.querySelector('summary')!.textContent).toBe('Export notes (1)');
    expect(notes.querySelector('li')!.textContent).toBe('<b>not html</b>'); // text, never HTML
  });

  it('is right-to-left for RTL locales, code stays LTR', async () => {
    editor = await setup();
    editor.I18n.setLocale('ar');
    editor.runCommand(COMMANDS.open);
    expect(dialog().dir).toBe('rtl');
    expect(dialog().querySelector('textarea')!.dir).toBe('ltr');
  });

  it('injectCss: false', async () => {
    editor = await setup({ injectCss: false });
    editor.runCommand(COMMANDS.open);
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});
