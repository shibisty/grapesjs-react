import type { Component } from 'grapesjs';
import type { HElement, HNode, HAttrValue } from './core/nodes';

export type { HNode, HElement, HText, HComment, HJsx, HAttrValue, JNode } from './core/nodes';

/** What a handler gets besides the component. */
export interface HandlerContext {
  /** The component's children, converted the default way. */
  children(): HNode[];
  /** The component converted the default way (as if there were no handler). */
  defaultNodes(): HNode[];
  /** Helpers to build nodes. */
  el(tag: string, attrs?: Record<string, HAttrValue>, children?: HNode[]): HElement;
  text(value: string): HNode;
  /** Adds a message to `result.warnings`. */
  warn(message: string): void;
  /** Resolved converter options. */
  options: Readonly<JsxOptions>;
}

/**
 * Custom conversion for a component type.
 *  - HNode / HNode[]  -> used instead of the default output;
 *  - string           -> inserted as ready JSX code (re-indented);
 *  - false            -> the component is left out;
 *  - null / undefined -> default conversion.
 */
export type JsxHandler = (
  component: Component,
  ctx: HandlerContext
) => HNode | HNode[] | string | false | null | undefined;

/** Options of the converter itself (also accepted per call). */
export interface JsxOptions {
  /** Name of the generated React component. Default: 'Page'. */
  componentName: string;
  /**
   * What the root wrapper (`<body>` in GrapesJS) becomes:
   *  - 'fragment' — `<>…</>`, or a `<div>` when the wrapper has attributes
   *    (classes, id targeted by CSS); a single child is returned without a fragment;
   *  - 'div' — always a `<div>` with the wrapper's attributes.
   */
  wrapper: 'fragment' | 'div';
  /**
   * CSS import added to the module: a path (`'./Page.css'`), `true` for
   * `./<componentName>.css`, or null/false for none. Default: null.
   */
  cssImport: string | boolean | null;
  /** Add `import React from 'react'` (classic JSX runtime). Default: true. */
  reactImport: boolean;
  /** 'default' -> `export default function Page`, 'named' -> `export function Page`. */
  exportType: 'default' | 'named';
  /** Indentation unit. Default: two spaces. */
  indent: string;
  /** Maximum line length the printer aims for. Default: 100. */
  printWidth: number;
  /** Keep HTML comments as `{/* … *\/}`. Default: true. */
  keepComments: boolean;
  /** Format the exported CSS one declaration per line. Default: true. */
  prettyCss: boolean;
  /**
   * Custom conversion per component type, e.g. `{ 'my-map': (c) => '<Map />' }`.
   * Plain components (no type) are addressed as `default`.
   */
  handlers: Record<string, JsxHandler>;
}

export interface ExportCallOptions extends Partial<JsxOptions> {
  /** Page to export (id). Default: the selected page. */
  pageId?: string;
  /** Pass-through to `editor.getCss()`, e.g. `{ avoidProtected: true }`. */
  cssOptions?: Record<string, unknown>;
}

export interface ExportFile {
  name: string;
  content: string;
  mime: string;
}

export interface JsxExportResult {
  /** The React component module. */
  jsx: string;
  /** CSS of the exported page. */
  css: string;
  /** Things that could not be carried over (scripts, inline handlers, …). */
  warnings: string[];
  /** `<Name>.jsx` and, when there is CSS, `<Name>.css`. */
  files: ExportFile[];
  /** The sanitised component name. */
  componentName: string;
}

export interface ExportJsxLabels {
  /** Tooltip of the panel button. */
  buttonTitle: string;
  /** Title of the export dialog. */
  modalTitle: string;
  copy: string;
  copied: string;
  download: string;
  /** Header of the warnings list in the dialog. */
  warnings: string;
}

export interface ButtonOptions {
  /** Panel to add the button to. Default: 'options'. */
  panel?: string;
  /** Button id. Default: 'export-jsx'. */
  id?: string;
}

/** Plugin options (`pluginsOpts`). */
export interface ExportJsxPluginOptions extends Partial<JsxOptions> {
  /**
   * Toolbar button that opens the export dialog. `true` (default) adds it to
   * the 'options' panel if that panel exists; `false` adds nothing.
   */
  button?: boolean | ButtonOptions;
  /** Override UI texts; otherwise they come from `editor.I18n`. */
  labels?: Partial<ExportJsxLabels>;
  /** Inject the dialog CSS. Default: true. */
  injectCss?: boolean;
  /** Also define `editor.getJsx()` (kept for compatibility). Default: true. */
  extendEditor?: boolean;
}
