/**
 * GrapesJS Component tree -> HNode.
 *
 * Works on live component models, not on `getProjectData()` JSON: the JSON
 * omits everything a component type adds at export time — `tagName` equal
 * to the type default (a `link` has no tagName in JSON, it is an <a> only by
 * type), model props turned into attributes (`controls` on a video, the
 * YouTube iframe `src`), and any custom `toHTML()`. `getAttrToHTML()` and
 * `tagName` are exactly what GrapesJS uses for its own HTML export.
 */
import type { Component } from 'grapesjs';
import { el, RAW_HTML_ATTR, RAW_TAG, text, type HElement, type HNode } from '../core/nodes';
import type { HandlerContext, JsxOptions } from '../types';
import { parseHtml } from './dom';

export interface ComponentSourceContext {
  options: JsxOptions;
  warn: (message: string) => void;
  /** HTML parser; null result = no DOM available. */
  parse?: (html: string) => HNode[] | null;
}

type AnyFn = (...args: unknown[]) => unknown;

interface BaseProto {
  toHTML: AnyFn;
  getInnerHTML: AnyFn;
  __innerHTML?: AnyFn;
}

/**
 * The prototype of the plain `default` component type, to detect types that
 * render themselves (custom `toHTML`/`getInnerHTML`): their output cannot be
 * rebuilt from attributes + children, so we convert their HTML instead.
 */
function baseProto(cmp: Component): BaseProto | null {
  const em = (cmp as unknown as { em?: { Components?: { getType(t: string): { model?: { prototype: BaseProto } } | undefined } } }).em;
  const fromType = em?.Components?.getType('default')?.model?.prototype;
  if (fromType) return fromType;
  // Walk up to the root class (Component) as a fallback.
  let proto = Object.getPrototypeOf(cmp) as BaseProto | null;
  let last: BaseProto | null = null;
  while (proto && typeof proto.toHTML === 'function') {
    last = proto;
    proto = Object.getPrototypeOf(proto) as BaseProto | null;
  }
  return last;
}

function rendersItself(cmp: Component, base: BaseProto | null): boolean {
  if (!base) return false;
  const c = cmp as unknown as BaseProto;
  return c.toHTML !== base.toHTML || c.getInnerHTML !== base.getInnerHTML || c.__innerHTML !== base.__innerHTML;
}

const label = (cmp: Component): string => {
  const name = (cmp.getName?.() as string | undefined) || cmp.get('type') || cmp.get('tagName') || 'component';
  return `"${name}"`;
};

export function componentToNodes(cmp: Component, ctx: ComponentSourceContext): HNode[] {
  const parse = ctx.parse ?? ((html: string) => parseHtml(html));
  const type = String(cmp.get('type') ?? '');

  const defaultNodes = (): HNode[] => convertDefault(cmp, ctx, parse);

  // Plain components have the type '' in GrapesJS; handlers address it as 'default'.
  const handler = ctx.options.handlers[type || 'default'];
  if (handler) {
    const hctx: HandlerContext = {
      children: () => childrenToNodes(cmp, ctx, parse),
      defaultNodes,
      el,
      text,
      warn: ctx.warn,
      options: ctx.options,
    };
    const out = handler(cmp, hctx);
    if (out === false) return [];
    if (typeof out === 'string') return [{ type: 'jsx', code: out }];
    if (Array.isArray(out)) return out;
    if (out) return [out];
  }
  return defaultNodes();
}

function childrenToNodes(cmp: Component, ctx: ComponentSourceContext, parse: ComponentSourceContext['parse'] & {}): HNode[] {
  const kids = cmp.components();
  if (kids.length) return kids.models.flatMap((c: Component) => componentToNodes(c, ctx));
  // No child components: GrapesJS renders `content` (raw inner HTML).
  const content = cmp.get('content');
  if (typeof content === 'string' && content !== '') {
    const parsed = parse(content);
    if (parsed) return parsed;
    return [el(RAW_TAG, { [RAW_HTML_ATTR]: content })];
  }
  return [];
}

function convertDefault(cmp: Component, ctx: ComponentSourceContext, parse: ComponentSourceContext['parse'] & {}): HNode[] {
  if (cmp.is('textnode')) return [text(String(cmp.get('content') ?? ''))];
  if (cmp.is('comment')) return [{ type: 'comment', text: String(cmp.get('content') ?? '') }];

  const tag = String(cmp.get('tagName') || 'div');
  if (tag.toLowerCase() === 'script' || cmp.is('script')) {
    ctx.warn(`<script> skipped (scripts are not exported to JSX)`);
    return [];
  }
  if (cmp.get('script')) {
    ctx.warn(`${label(cmp)} has a component script; its behaviour is not exported (only markup)`);
  }

  if (rendersItself(cmp, baseProto(cmp))) {
    const html = String(cmp.toHTML());
    const parsed = parse(html);
    if (parsed) return parsed;
    ctx.warn(`${label(cmp)} uses its own toHTML() and there is no DOM to parse it; exported as raw HTML`);
    return [el('div', { [RAW_HTML_ATTR]: html })];
  }

  const attrs = { ...(cmp.getAttrToHTML() as Record<string, unknown>) } as Record<string, string | boolean | number>;
  const children = childrenToNodes(cmp, ctx, parse);
  const raw = rawChild(children);
  if (raw) {
    // Unparsed inner HTML: keep the element, inject its content.
    attrs[RAW_HTML_ATTR] = raw.attrs[RAW_HTML_ATTR] as string;
    ctx.warn(`${label(cmp)} content exported as raw HTML (no DOM to parse it)`);
    return [el(tag, attrs, [])];
  }
  return [el(tag, attrs, children)];
}

function rawChild(children: HNode[]): HElement | null {
  const c = children[0];
  return children.length === 1 && c.type === 'element' && c.tag === RAW_TAG ? c : null;
}

/**
 * The page root. `wrapper: 'fragment'` drops the wrapper element unless it
 * has attributes worth keeping.
 */
export function wrapperToNodes(wrapper: Component, ctx: ComponentSourceContext): HNode[] {
  const parse = ctx.parse ?? ((html: string) => parseHtml(html));
  const attrs = { ...(wrapper.getAttrToHTML() as Record<string, string | boolean | number>) };
  const children = childrenToNodes(wrapper, ctx, parse);
  const hasAttrs = Object.values(attrs).some((v) => v !== false && v !== null && v !== undefined);
  const raw = rawChild(children);
  if (raw) {
    ctx.warn('page content exported as raw HTML (no DOM to parse it)');
    return [el('div', { ...attrs, [RAW_HTML_ATTR]: raw.attrs[RAW_HTML_ATTR] })];
  }
  if (ctx.options.wrapper === 'fragment' && !hasAttrs) return children;
  return [el('div', attrs, children)];
}
