/**
 * Public conversion functions that do not need a running plugin.
 */
import type { Component } from 'grapesjs';
import type { HNode } from './core/nodes';
import { transformRoot } from './core/transform';
import { printNode } from './core/print';
import { buildModule, toComponentName } from './core/module';
import { cssImportPath, resolveJsxOptions } from './options';
import { componentToNodes, wrapperToNodes } from './source/component';
import { parseHtml } from './source/dom';
import type { JsxOptions } from './types';

export interface ConvertResult {
  /** The whole module: imports + component function. */
  jsx: string;
  /** Only the JSX expression returned by the component. */
  markup: string;
  warnings: string[];
  componentName: string;
}

const unique = (list: string[]): string[] => [...new Set(list)];

/** HNode tree -> React component module. */
export function convertNodes(nodes: HNode[], options: Partial<JsxOptions> = {}, warnings: string[] = []): ConvertResult {
  const opts = resolveJsxOptions(options);
  const warn = (m: string) => warnings.push(m);
  const componentName = toComponentName(opts.componentName);
  const root = transformRoot(nodes, { keepComments: opts.keepComments, warn });
  const markup = printNode(root, { indent: opts.indent, printWidth: opts.printWidth }, 2);
  const jsx = buildModule(markup, {
    componentName,
    reactImport: opts.reactImport,
    cssImport: cssImportPath(opts, componentName),
    exportType: opts.exportType,
    indent: opts.indent,
  });
  return { jsx, markup, warnings: unique(warnings), componentName };
}

/**
 * A GrapesJS component (usually `editor.getWrapper()` or a page's main
 * component) -> React component module, with details.
 */
export function convertComponent(component: Component, options: Partial<JsxOptions> = {}): ConvertResult {
  const opts = resolveJsxOptions(options);
  const warnings: string[] = [];
  const ctx = { options: opts, warn: (m: string) => warnings.push(m) };
  const nodes = component.is('wrapper') ? wrapperToNodes(component, ctx) : componentToNodes(component, ctx);
  return convertNodes(nodes, opts, warnings);
}

/** Same as `convertComponent`, returns only the module code. */
export function componentToJsx(component: Component, options: Partial<JsxOptions> = {}): string {
  return convertComponent(component, options).jsx;
}

/**
 * Any HTML string -> React component module. Needs a DOM (browser/jsdom).
 * Handy for HTML that never was in GrapesJS, e.g. `editor.getHtml()` of
 * another editor or a stored template.
 */
export function htmlToJsx(html: string, options: Partial<JsxOptions> = {}): string {
  const nodes = parseHtml(html);
  if (!nodes) throw new Error('htmlToJsx needs a DOM (document) to parse HTML');
  return convertNodes(nodes, options).jsx;
}
