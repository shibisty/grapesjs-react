/** HTML facts the converter relies on. */

export const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

/**
 * Elements rendered inline by default. Whitespace between two inline things
 * is a visible space, so it has to survive in JSX as `{" "}`. Unknown tags
 * (custom elements) are treated as inline too: an extra `{" "}` between
 * blocks is harmless, a lost space between words is not.
 */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'acronym', 'audio', 'b', 'bdi', 'bdo', 'big', 'br', 'button',
  'canvas', 'cite', 'code', 'data', 'datalist', 'del', 'dfn', 'em', 'embed',
  'font', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'map', 'mark',
  'meter', 'noscript', 'object', 'output', 'picture', 'progress', 'q', 'ruby',
  'rp', 'rt', 's', 'samp', 'select', 'slot', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'svg', 'textarea', 'time', 'tt', 'u', 'var', 'video',
  'wbr',
]);

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'caption', 'col',
  'colgroup', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'head', 'header', 'hgroup', 'hr', 'html', 'legend', 'li', 'link', 'main',
  'menu', 'meta', 'nav', 'ol', 'optgroup', 'option', 'p', 'pre', 'script',
  'section', 'select-content', 'source', 'style', 'summary', 'table', 'tbody',
  'td', 'template', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul',
]);

/** `Link`, `Foo.Bar`: a React component, not an HTML element. */
export const isComponentTag = (tag: string): boolean => !/^[a-z]/.test(tag);

export function isInlineTag(tag: string): boolean {
  // Components (from handlers) may render anything; keep the spaces around them.
  if (isComponentTag(tag)) return true;
  const t = tag.toLowerCase();
  if (INLINE_TAGS.has(t)) return true;
  return !BLOCK_TAGS.has(t);
}

/** Whitespace inside these is rendered exactly as written. */
export const PRESERVE_WS_TAGS = new Set(['pre', 'textarea', 'listing', 'plaintext', 'xmp']);

/** Never exported: React would not run them, and `<style>` belongs in the CSS file. */
export const SKIPPED_TAGS = new Set(['script']);
