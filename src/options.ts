import type { JsxOptions } from './types';

export const DEFAULT_JSX_OPTIONS: Readonly<JsxOptions> = Object.freeze({
  componentName: 'Page',
  wrapper: 'fragment',
  cssImport: null,
  reactImport: true,
  exportType: 'default',
  indent: '  ',
  printWidth: 100,
  keepComments: true,
  prettyCss: true,
  handlers: {},
});

/**
 * Merges option layers left to right (defaults, plugin options, call
 * options). `undefined` never overrides; `handlers` are merged per type.
 */
export function resolveJsxOptions(...layers: (Partial<JsxOptions> | undefined | null)[]): JsxOptions {
  const out: JsxOptions = { ...DEFAULT_JSX_OPTIONS, handlers: {} };
  for (const layer of layers) {
    if (!layer) continue;
    (Object.keys(layer) as (keyof JsxOptions)[]).forEach((key) => {
      const value = layer[key];
      if (value === undefined) return;
      if (key === 'handlers') out.handlers = { ...out.handlers, ...(value as JsxOptions['handlers']) };
      else (out as unknown as Record<string, unknown>)[key] = value;
    });
  }
  if (out.wrapper !== 'div') out.wrapper = 'fragment';
  if (out.exportType !== 'named') out.exportType = 'default';
  if (typeof out.indent !== 'string' || /[^ \t]/.test(out.indent) || !out.indent) out.indent = '  ';
  if (!(out.printWidth > 0)) out.printWidth = DEFAULT_JSX_OPTIONS.printWidth;
  return out;
}

/** `cssImport` option -> the path to import, or null. */
export function cssImportPath(opts: JsxOptions, componentName: string): string | null {
  if (opts.cssImport === true) return `./${componentName}.css`;
  if (typeof opts.cssImport === 'string' && opts.cssImport.trim()) return opts.cssImport.trim();
  return null;
}
