/**
 * Two small trees the converter works with.
 *
 * HNode — a neutral HTML tree (what the page IS). Produced by the sources
 * (GrapesJS components, a DOM/HTML string) and by custom handlers.
 *
 * JNode — a JSX tree (how it is WRITTEN). Produced by `transform` from an
 * HNode: React prop names, uncontrolled form values, whitespace that survives
 * JSX's line trimming. `print` turns it into code.
 */

export type HAttrValue = string | number | boolean | null | undefined;

export interface HElement {
  type: 'element';
  /** Lower-case for HTML; SVG keeps its case (`linearGradient`). */
  tag: string;
  attrs: Record<string, HAttrValue>;
  children: HNode[];
}

export interface HText {
  type: 'text';
  /** Decoded text, exactly as it would appear in the DOM. */
  text: string;
}

export interface HComment {
  type: 'comment';
  text: string;
}

/** Ready-made JSX code (e.g. returned by a custom handler as a string). */
export interface HJsx {
  type: 'jsx';
  code: string;
}

export type HNode = HElement | HText | HComment | HJsx;

export interface JProp {
  /** Prop name, or `...` for a spread (`{...expr}`). */
  name: string;
  /** String literal value (printed as `name="..."` or `name={"..."}`). */
  value?: string;
  /** JS expression (printed as `name={expr}`). */
  expr?: string;
  /** Neither value nor expr: a bare boolean prop (`disabled`). */
}

export interface JElement {
  type: 'element';
  /** Empty string = fragment `<>...</>`. */
  tag: string;
  props: JProp[];
  children: JNode[];
}

/** Plain JSX text: never has meaningful edge whitespace, never contains `{}<>`. */
export interface JText {
  type: 'text';
  text: string;
}

/** `{expr}` child: `{" "}`, `{"a < b"}`, `{/* comment *\/}`. */
export interface JExpr {
  type: 'expr';
  code: string;
}

/** Multi-line JSX code inserted as is (re-indented). */
export interface JRaw {
  type: 'raw';
  code: string;
}

export type JNode = JElement | JText | JExpr | JRaw;

/**
 * Internal attribute: raw inner HTML that could not be parsed (no DOM).
 * Becomes `dangerouslySetInnerHTML`. Not a possible real attribute name.
 */
export const RAW_HTML_ATTR = '\u0000innerHTML';

/** Internal placeholder element for unparsed inner HTML (printed as a div). */
export const RAW_TAG = '\u0000raw';

export const el = (tag: string, attrs: Record<string, HAttrValue> = {}, children: HNode[] = []): HElement => ({
  type: 'element',
  tag,
  attrs,
  children,
});

export const text = (value: string): HText => ({ type: 'text', text: value });
