import grapesjs, { type Editor } from 'grapesjs';
import { parse } from '@babel/parser';

export interface EditorSetup {
  components?: string;
  style?: string;
  plugins?: ((editor: Editor) => void)[];
  config?: Record<string, unknown>;
}

/** A real grapesjs editor in jsdom. */
export async function createEditor(setup: EditorSetup = {}): Promise<Editor> {
  const container = document.createElement('div');
  container.id = 'gjs';
  document.body.append(container);
  const editor = grapesjs.init({
    container,
    height: '600px',
    storageManager: false,
    telemetry: false,
    components: setup.components ?? '',
    style: setup.style ?? '',
    plugins: setup.plugins ?? [],
    ...(setup.config ?? {}),
  } as Parameters<typeof grapesjs.init>[0]);
  await new Promise<void>((resolve) => editor.onReady(() => resolve()));
  return editor;
}

export async function destroyEditor(editor: Editor | undefined): Promise<void> {
  if (!editor) return;
  // Let GrapesJS' own debounced handlers run before the teardown.
  await new Promise((r) => setTimeout(r, 10));
  try {
    editor.destroy();
  } catch {
    /* ignore teardown noise from jsdom */
  }
  document.body.innerHTML = '';
}

/** Throws if the code is not valid JSX (Babel, the parser React projects use). */
export function assertValidJsx(code: string): void {
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
}
