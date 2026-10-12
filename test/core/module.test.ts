import { describe, expect, it } from 'vitest';
import { buildModule, toComponentName } from '../../src/core/module';
import { cssImportPath, DEFAULT_JSX_OPTIONS, resolveJsxOptions } from '../../src/options';
import { assertValidJsx } from '../helpers/editor';

describe('toComponentName', () => {
  it.each([
    ['Page', 'Page'],
    ['my page', 'MyPage'],
    ['landing-page_v2', 'LandingPageV2'],
    ['404 page', 'Page404Page'],
    ['', 'Page'],
    [undefined, 'Page'],
    ['  ', 'Page'],
    ['главная', 'Page'],
    ['Café crème', 'CafeCreme'],
    ['$store', '$store'],
  ])('%s -> %s', (input, out) => {
    expect(toComponentName(input as string)).toBe(out);
  });
});

describe('buildModule', () => {
  const base = { componentName: 'Page', reactImport: true, cssImport: null, exportType: 'default' as const, indent: '  ' };

  it('default export with React import', () => {
    const code = buildModule('    <div />', base);
    expect(code).toBe("import React from 'react';\n\nexport default function Page() {\n  return (\n    <div />\n  );\n}\n");
    assertValidJsx(code);
  });

  it('named export, CSS import, no React import', () => {
    const code = buildModule('    <div />', { ...base, reactImport: false, cssImport: "./it's.css", exportType: 'named' });
    expect(code.startsWith("import './it\\'s.css';\n\nexport function Page()")).toBe(true);
    assertValidJsx(code);
  });
});

describe('options', () => {
  it('defaults', () => {
    expect(resolveJsxOptions()).toEqual({ ...DEFAULT_JSX_OPTIONS, handlers: {} });
  });

  it('later layers win, undefined does not override, handlers merge', () => {
    const h1 = () => null;
    const h2 = () => null;
    const o = resolveJsxOptions({ componentName: 'A', handlers: { a: h1 } }, { componentName: undefined, handlers: { b: h2 } });
    expect(o.componentName).toBe('A');
    expect(o.handlers).toEqual({ a: h1, b: h2 });
  });

  it('sanitises invalid values', () => {
    const o = resolveJsxOptions({ wrapper: 'x' as never, exportType: 'y' as never, indent: 'ab', printWidth: -1 });
    expect(o).toMatchObject({ wrapper: 'fragment', exportType: 'default', indent: '  ', printWidth: 100 });
  });

  it('cssImport', () => {
    expect(cssImportPath(resolveJsxOptions({ cssImport: true }), 'Home')).toBe('./Home.css');
    expect(cssImportPath(resolveJsxOptions({ cssImport: './x.css' }), 'Home')).toBe('./x.css');
    expect(cssImportPath(resolveJsxOptions({ cssImport: false }), 'Home')).toBeNull();
  });
});
