/** Wraps a printed JSX expression into a React component module. */

export interface ModuleOptions {
  /** Component (function) name. Sanitised into a valid PascalCase identifier. */
  componentName: string;
  /** `import React from 'react'` — only needed with the classic JSX runtime. */
  reactImport: boolean;
  /** Path of a CSS file to import, e.g. `./Page.css`. */
  cssImport: string | null;
  /** `export default function Page` or `export function Page`. */
  exportType: 'default' | 'named';
  indent: string;
}

const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return',
  'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'let', 'static', 'implements', 'interface',
  'package', 'private', 'protected', 'public', 'await',
]);

/**
 * "my page" -> "MyPage", "404-page" -> "Page404Page", "" -> "Page".
 * React components must start with an upper-case letter.
 */
export function toComponentName(name: string | undefined | null, fallback = 'Page'): string {
  const words = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w$]+/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let id = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (!id) return fallback;
  if (/^\d/.test(id)) id = fallback + id;
  if (!/^[A-Z$]/.test(id)) id = id.charAt(0).toUpperCase() + id.slice(1);
  return RESERVED.has(id) ? `${id}Component` : id;
}

const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

export function buildModule(jsxBody: string, opts: ModuleOptions): string {
  const name = toComponentName(opts.componentName);
  const imports: string[] = [];
  if (opts.reactImport) imports.push("import React from 'react';");
  if (opts.cssImport) imports.push(`import ${quote(opts.cssImport)};`);
  const i = opts.indent;
  const exp = opts.exportType === 'named' ? 'export function' : 'export default function';
  return [
    ...(imports.length ? [...imports, ''] : []),
    `${exp} ${name}() {`,
    `${i}return (`,
    jsxBody,
    `${i});`,
    '}',
    '',
  ].join('\n');
}
