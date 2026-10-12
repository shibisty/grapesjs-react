/**
 * HTML attribute -> React prop. Pure functions, no DOM.
 */
import type { HAttrValue, JProp } from './nodes';

/** Lower-case HTML attributes React spells differently. */
export const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  'accept-charset': 'acceptCharset',
  'http-equiv': 'httpEquiv',
  accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen',
  allowtransparency: 'allowTransparency',
  autocapitalize: 'autoCapitalize',
  autocomplete: 'autoComplete',
  autocorrect: 'autoCorrect',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  autosave: 'autoSave',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  classid: 'classID',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  contextmenu: 'contextMenu',
  controlslist: 'controlsList',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  disablepictureinpicture: 'disablePictureInPicture',
  disableremoteplayback: 'disableRemotePlayback',
  enctype: 'encType',
  enterkeyhint: 'enterKeyHint',
  fetchpriority: 'fetchPriority',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  itemid: 'itemID',
  itemprop: 'itemProp',
  itemref: 'itemRef',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  keyparams: 'keyParams',
  keytype: 'keyType',
  marginheight: 'marginHeight',
  marginwidth: 'marginWidth',
  maxlength: 'maxLength',
  mediagroup: 'mediaGroup',
  minlength: 'minLength',
  nomodule: 'noModule',
  novalidate: 'noValidate',
  playsinline: 'playsInline',
  radiogroup: 'radioGroup',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
  popovertarget: 'popoverTarget',
  popovertargetaction: 'popoverTargetAction',
  // namespaced SVG/XML attributes
  'xlink:actuate': 'xlinkActuate',
  'xlink:arcrole': 'xlinkArcrole',
  'xlink:href': 'xlinkHref',
  'xlink:role': 'xlinkRole',
  'xlink:show': 'xlinkShow',
  'xlink:title': 'xlinkTitle',
  'xlink:type': 'xlinkType',
  'xml:base': 'xmlBase',
  'xml:lang': 'xmlLang',
  'xml:space': 'xmlSpace',
  'xmlns:xlink': 'xmlnsXlink',
};

/** Attributes whose mere presence means "on" (value "" or the name itself). */
export const BOOLEAN_ATTRS = new Set([
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls',
  'default', 'defer', 'disabled', 'formnovalidate', 'hidden', 'inert',
  'itemscope', 'loop', 'multiple', 'muted', 'nomodule', 'novalidate', 'open',
  'playsinline', 'readonly', 'required', 'reversed', 'selected',
]);

export const camelCase = (s: string): string => s.replace(/[-:]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());

const JSX_NAME = /^[A-Za-z_$][\w$]*(-[\w$]+)*$/;

/**
 * React prop name for an HTML attribute, or null when the attribute name is
 * not a valid JSX attribute name (`@click`, `:href`, `x.y`) — such attributes
 * are emitted as a spread instead.
 */
export function propName(attr: string, inSvg: boolean): string | null {
  const lower = attr.toLowerCase();
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return JSX_NAME.test(lower) ? lower : null;
  if (ATTR_MAP[lower]) return ATTR_MAP[lower];
  // SVG presentation attributes are camelCase in React: stroke-width -> strokeWidth.
  if (inSvg && attr.includes('-')) return camelCase(attr);
  // Any other hyphenated name (custom elements, x-data, hx-get…) is passed
  // through by React as is, and is a valid JSX attribute name.
  return JSX_NAME.test(attr) ? attr : null;
}

/* ------------------------------ style ------------------------------ */

/** Splits `a:b; c:url(x;y)` on top-level semicolons only. */
function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  for (const ch of css) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * CSS property -> React style key.
 *   --brand        -> "--brand" (custom properties stay as they are)
 *   -webkit-filter -> WebkitFilter, -moz-x -> MozX, -ms-x -> msX (React's rule)
 *   background-color -> backgroundColor
 */
export function styleKey(prop: string): string {
  const p = prop.trim();
  if (p.startsWith('--')) return p;
  const lower = p.toLowerCase();
  if (lower.startsWith('-ms-')) return camelCase(lower.slice(1));
  if (lower.startsWith('-')) {
    const c = camelCase(lower.slice(1));
    return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return camelCase(lower);
}

export interface StyleResult {
  entries: [string, string][];
  /** `!important` cannot be expressed in a React style object. */
  droppedImportant: boolean;
}

export function parseStyle(style: string | Record<string, unknown>): StyleResult {
  let droppedImportant = false;
  const pairs: [string, string][] = [];
  const add = (prop: string, raw: unknown) => {
    let value = String(raw ?? '').trim();
    if (/!\s*important\s*$/i.test(value)) {
      droppedImportant = true;
      value = value.replace(/\s*!\s*important\s*$/i, '');
    }
    const key = prop.trim();
    if (!key || !value) return;
    pairs.push([styleKey(key), value]);
  };

  if (typeof style === 'string') {
    const clean = style.replace(/\/\*[\s\S]*?\*\//g, '');
    splitDeclarations(clean).forEach((decl) => {
      const i = decl.indexOf(':');
      if (i > 0) add(decl.slice(0, i), decl.slice(i + 1));
    });
  } else if (style && typeof style === 'object') {
    Object.entries(style).forEach(([k, v]) => add(k, v));
  }
  // Last declaration wins, like in CSS.
  const map = new Map<string, string>();
  pairs.forEach(([k, v]) => {
    map.delete(k);
    map.set(k, v);
  });
  return { entries: [...map.entries()], droppedImportant };
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

export function styleObjectCode(entries: [string, string][]): string {
  const body = entries
    .map(([k, v]) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(', ');
  return `{ ${body} }`;
}

/* ------------------------------ values ------------------------------ */

/**
 * JSX decodes HTML entities in attribute strings (`"&copy;"` becomes `©`) and
 * has no escape for `"`: such values must be written as JS strings.
 */
const ENTITY_LIKE = /&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);?/i;

export function needsExpression(value: string): boolean {
  return value.includes('"') || /[\r\n\\]/.test(value) || ENTITY_LIKE.test(value);
}

export function stringProp(name: string, value: string): JProp {
  return needsExpression(value) ? { name, expr: JSON.stringify(value) } : { name, value };
}

export interface AttrContext {
  tag: string;
  inSvg: boolean;
  warn: (message: string) => void;
}

/**
 * One attribute -> zero or one prop. Form values are handled by `transform`
 * (they depend on the element, not just on the attribute).
 */
export function attrToProp(attr: string, value: HAttrValue, ctx: AttrContext): JProp | null {
  if (value === false || value === null || value === undefined) return null;
  const lower = attr.toLowerCase();

  if (/^on[a-z]/.test(lower)) {
    ctx.warn(`<${ctx.tag}> inline handler "${attr}" dropped (attach handlers in React code instead)`);
    return null;
  }

  if (lower === 'style') {
    const { entries, droppedImportant } = parseStyle(typeof value === 'string' ? value : String(value));
    if (droppedImportant) ctx.warn(`<${ctx.tag}> "!important" dropped from an inline style (not supported by React)`);
    return entries.length ? { name: 'style', expr: styleObjectCode(entries) } : null;
  }

  const name = propName(attr, ctx.inSvg);
  if (!name) {
    // Not a valid JSX attribute name: keep it via a spread object.
    const v = value === true ? '' : String(value);
    return { name: '...', expr: `{ ${JSON.stringify(attr)}: ${JSON.stringify(v)} }` };
  }

  if (value === true) return { name };
  const str = String(value);
  if (BOOLEAN_ATTRS.has(lower) && (str === '' || str.toLowerCase() === lower || str === 'true')) return { name };
  if (typeof value === 'number') return { name, expr: String(value) };
  return stringProp(name, str);
}
