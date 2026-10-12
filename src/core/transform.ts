/**
 * HNode (HTML) -> JNode (JSX). Pure, no DOM.
 *
 * Responsibilities:
 *  - attribute -> prop mapping (see props.ts);
 *  - form fields as *uncontrolled* React inputs: value/checked on <input>
 *    become defaultValue/defaultChecked, <textarea> text becomes
 *    defaultValue, <option selected> becomes defaultValue on its <select>;
 *  - whitespace: HTML collapses it, JSX trims it at line breaks. Every space
 *    that is visible in the browser is kept as `{" "}`, every newline that
 *    is just formatting is dropped.
 */
import { RAW_HTML_ATTR, RAW_TAG, type HAttrValue, type HElement, type HNode, type JElement, type JNode, type JProp } from './nodes';
import { isComponentTag, isInlineTag, PRESERVE_WS_TAGS, SKIPPED_TAGS, VOID_TAGS } from './html';
import { attrToProp, stringProp } from './props';

export interface TransformOptions {
  /** Keep HTML comments as `{/* ... *\/}`. */
  keepComments: boolean;
}

export interface TransformContext extends TransformOptions {
  warn: (message: string) => void;
}

const WS = /[ \t\n\r\f]+/g;
const SPECIAL_TEXT = /[{}<>]|&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);?/i;

const isOn = (v: HAttrValue, name: string): boolean =>
  v === true || v === '' || v === 'true' || (typeof v === 'string' && v.toLowerCase() === name);

/** All text inside a subtree, as the DOM `textContent` would return it. */
function textContent(nodes: HNode[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.text : n.type === 'element' ? textContent(n.children) : ''))
    .join('');
}

/* ----------------------------- elements ----------------------------- */

function optionValue(opt: HElement): string {
  const v = opt.attrs.value;
  if (v !== undefined && v !== null && v !== false) return String(v);
  return textContent(opt.children).replace(WS, ' ').trim();
}

/** <option selected> -> remove `selected`, return the chosen values. */
function takeSelectedOptions(nodes: HNode[], out: string[]): HNode[] {
  return nodes.map((n) => {
    if (n.type !== 'element') return n;
    const tag = n.tag.toLowerCase();
    if (tag === 'option') {
      const attrs = { ...n.attrs };
      const sel = Object.keys(attrs).find((k) => k.toLowerCase() === 'selected');
      if (sel && isOn(attrs[sel], 'selected')) out.push(optionValue(n));
      if (sel) delete attrs[sel];
      return { ...n, attrs };
    }
    if (tag === 'optgroup') return { ...n, children: takeSelectedOptions(n.children, out) };
    return n;
  });
}

function pickAttr(attrs: Record<string, HAttrValue>, name: string): [string, HAttrValue] | null {
  const key = Object.keys(attrs).find((k) => k.toLowerCase() === name);
  return key ? [key, attrs[key]] : null;
}

export function transformElement(node: HElement, ctx: TransformContext, inSvg = false): JElement {
  const tag = node.tag === RAW_TAG ? 'div' : node.tag;
  // HTML rules (void, forms, whitespace) apply to HTML elements only, not to
  // components a handler produced (`Link` is not `<link>`).
  const lower = isComponentTag(tag) ? '' : tag.toLowerCase();
  const svg = inSvg || lower === 'svg';
  const attrs = { ...node.attrs };
  let children = node.children;
  const extra: JProp[] = [];

  if (lower === 'input') {
    // Uncontrolled inputs: React warns about `value` without onChange.
    const value = pickAttr(attrs, 'value');
    if (value) {
      delete attrs[value[0]];
      if (value[1] !== false && value[1] != null) extra.push(stringProp('defaultValue', String(value[1])));
    }
    const checked = pickAttr(attrs, 'checked');
    if (checked) {
      delete attrs[checked[0]];
      if (isOn(checked[1], 'checked')) extra.push({ name: 'defaultChecked' });
    }
  } else if (lower === 'textarea') {
    const value = textContent(children);
    children = [];
    const attrValue = pickAttr(attrs, 'value');
    if (attrValue) delete attrs[attrValue[0]];
    const v = value || (attrValue && attrValue[1] != null && attrValue[1] !== false ? String(attrValue[1]) : '');
    if (v) extra.push(stringProp('defaultValue', v));
  } else if (lower === 'select') {
    const selected: string[] = [];
    children = takeSelectedOptions(children, selected);
    const multiple = pickAttr(attrs, 'multiple');
    if (selected.length) {
      if (multiple && isOn(multiple[1], 'multiple')) {
        extra.push({ name: 'defaultValue', expr: JSON.stringify(selected) });
      } else {
        extra.push(stringProp('defaultValue', selected[selected.length - 1]));
      }
    }
  }

  if (RAW_HTML_ATTR in attrs) {
    const html = attrs[RAW_HTML_ATTR];
    delete attrs[RAW_HTML_ATTR];
    children = [];
    if (typeof html === 'string' && html) {
      extra.push({ name: 'dangerouslySetInnerHTML', expr: `{ __html: ${JSON.stringify(html)} }` });
    }
  }

  const props: JProp[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    const p = attrToProp(name, value, { tag, inSvg: svg, warn: ctx.warn });
    if (p) props.push(p);
  }
  props.push(...extra);

  const kids = VOID_TAGS.has(lower) ? [] : transformChildren(children, ctx, { tag: lower || tag, svg });
  return { type: 'element', tag, props, children: kids };
}

/* ----------------------------- children ----------------------------- */

interface ParentInfo {
  /** Lower-case tag, or '' for a root/fragment. */
  tag: string;
  svg: boolean;
}

type Item =
  | { kind: 'text'; text: string }
  | { kind: 'node'; node: HNode; inline: boolean }
  | { kind: 'comment'; text: string };

function isRendered(n: HNode): boolean {
  return !(n.type === 'element' && !isComponentTag(n.tag) && SKIPPED_TAGS.has(n.tag.toLowerCase()));
}

export function transformChildren(nodes: HNode[], ctx: TransformContext, parent: ParentInfo): JNode[] {
  // 1. Drop skipped elements, merge adjacent text nodes.
  const items: Item[] = [];
  for (const n of nodes) {
    if (!isRendered(n)) {
      ctx.warn(`<${(n as HElement).tag}> skipped (scripts are not exported to JSX)`);
      continue;
    }
    if (n.type === 'text') {
      const last = items[items.length - 1];
      if (last && last.kind === 'text') last.text += n.text;
      else items.push({ kind: 'text', text: n.text });
    } else if (n.type === 'comment') {
      if (ctx.keepComments) items.push({ kind: 'comment', text: n.text });
    } else {
      items.push({ kind: 'node', node: n, inline: n.type === 'jsx' || isInlineTag(n.tag) });
    }
  }

  // 2. Whitespace-preserving parents: every text node becomes a JS string.
  if (PRESERVE_WS_TAGS.has(parent.tag)) {
    return items.map((it) => {
      if (it.kind === 'text') return { type: 'expr', code: `{${JSON.stringify(it.text)}}` };
      if (it.kind === 'comment') return commentNode(it.text);
      return nodeToJsx(it.node, ctx, parent.svg);
    });
  }

  const parentInline = parent.tag !== '' && isInlineTag(parent.tag);
  // Is the neighbour of item i, in direction dir, inline content?
  const inlineAt = (i: number, dir: -1 | 1): boolean => {
    for (let j = i + dir; j >= 0 && j < items.length; j += dir) {
      const it = items[j];
      if (it.kind === 'comment') continue; // comments do not render
      if (it.kind === 'text') return true;
      return it.inline;
    }
    return parentInline; // edge of the parent
  };

  const out: JNode[] = [];
  items.forEach((it, i) => {
    if (it.kind === 'comment') {
      out.push(commentNode(it.text));
      return;
    }
    if (it.kind === 'node') {
      out.push(nodeToJsx(it.node, ctx, parent.svg));
      return;
    }

    const collapsed = it.text.replace(WS, ' ');
    const core = collapsed.trim();
    const lead = collapsed.startsWith(' ') && inlineAt(i, -1);
    const trail = collapsed.endsWith(' ') && inlineAt(i, 1);

    if (!core) {
      // In SVG only <text>/<tspan>/… render text; whitespace between shapes is noise.
      if (lead && trail && !(parent.svg && !SVG_TEXT_TAGS.has(parent.tag))) out.push(SPACE);
      return;
    }
    if (SPECIAL_TEXT.test(core)) {
      out.push({ type: 'expr', code: `{${JSON.stringify(`${lead ? ' ' : ''}${core}${trail ? ' ' : ''}`)}}` });
      return;
    }
    if (lead) out.push(SPACE);
    out.push({ type: 'text', text: core });
    if (trail) out.push(SPACE);
  });

  // Two spaces in a row can only come from text + whitespace-only text merges; keep one.
  return out.filter((n, i) => !(n === SPACE && out[i - 1] === SPACE));
}

const SVG_TEXT_TAGS = new Set(['text', 'tspan', 'textpath', 'title', 'desc']);

const SPACE: JNode = { type: 'expr', code: '{" "}' };

function commentNode(text: string): JNode {
  const clean = text.replace(/\*\//g, '* /').trim();
  return { type: 'expr', code: clean.includes('\n') ? `{/*\n${clean}\n*/}` : `{/* ${clean} */}` };
}

function nodeToJsx(node: HNode, ctx: TransformContext, inSvg: boolean): JNode {
  if (node.type === 'jsx') return { type: 'raw', code: node.code };
  if (node.type === 'element') return transformElement(node, ctx, inSvg);
  if (node.type === 'comment') return commentNode(node.text);
  return { type: 'expr', code: `{${JSON.stringify(node.text)}}` };
}

/**
 * Root: a list of top-level nodes -> one JSX expression.
 * A single element is returned as is, several are wrapped in a fragment.
 */
export function transformRoot(nodes: HNode[], ctx: TransformContext): JNode {
  const kids = transformChildren(nodes, ctx, { tag: '', svg: false });
  if (kids.length === 1 && (kids[0].type === 'element' || kids[0].type === 'raw')) return kids[0];
  return { type: 'element', tag: '', props: [], children: kids };
}
