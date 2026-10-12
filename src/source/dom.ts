/** DOM nodes / HTML strings -> HNode. Needs a DOM (browser, jsdom). */
import type { HAttrValue, HNode } from '../core/nodes';

const ELEMENT = 1;
const TEXT = 3;
const CDATA = 4;
const COMMENT = 8;

export function domToNodes(nodes: ArrayLike<Node>): HNode[] {
  const out: HNode[] = [];
  Array.from(nodes).forEach((n) => {
    if (n.nodeType === TEXT || n.nodeType === CDATA) {
      out.push({ type: 'text', text: n.nodeValue ?? '' });
    } else if (n.nodeType === COMMENT) {
      out.push({ type: 'comment', text: n.nodeValue ?? '' });
    } else if (n.nodeType === ELEMENT) {
      const elm = n as Element;
      const attrs: Record<string, HAttrValue> = {};
      Array.from(elm.attributes).forEach((a) => {
        attrs[a.name] = a.value;
      });
      // <template> keeps its children in .content
      const kids = elm.localName === 'template' ? (elm as HTMLTemplateElement).content.childNodes : elm.childNodes;
      out.push({ type: 'element', tag: elm.localName, attrs, children: domToNodes(kids) });
    }
  });
  return out;
}

/**
 * Parses an HTML fragment without executing anything (a <template> is
 * inert). Returns null when there is no DOM to parse with.
 */
export function parseHtml(html: string, doc: Document | undefined = globalThis.document): HNode[] | null {
  if (!doc || typeof doc.createElement !== 'function') return null;
  const tpl = doc.createElement('template');
  tpl.innerHTML = html;
  return domToNodes(tpl.content.childNodes);
}
