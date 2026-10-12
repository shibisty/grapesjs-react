/**
 * grapesjs-plugin-export-jsx
 *
 * Препроцессор: JSON-дерево компонентов GrapesJS -> JSX.
 * HTML не используется вообще.
 *
 * Использование:
 *   grapesjs.init({ plugins: [exportJsx], pluginsOpts: { [exportJsx]: { componentName: 'Page' } } });
 *   const { jsx, css } = editor.getJsx();
 *   // или: editor.runCommand('export-jsx')  -> { jsx, css }
 *
 * Чистая функция без editor тоже доступна: componentToJsx(json, opts)
 */

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

// HTML-атрибут -> React prop
const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  contenteditable: 'contentEditable',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  crossorigin: 'crossOrigin',
  enctype: 'encType',
  frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen',
  srcset: 'srcSet',
  srcdoc: 'srcDoc',
  datetime: 'dateTime',
  novalidate: 'noValidate',
  spellcheck: 'spellCheck',
  usemap: 'useMap',
  accesskey: 'accessKey',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  'http-equiv': 'httpEquiv',
  'accept-charset': 'acceptCharset',
  // controlled -> uncontrolled, чтобы React не ругался
  value: 'defaultValue',
  checked: 'defaultChecked',
  selected: 'defaultSelected',
};

const BOOL_ATTRS = new Set([
  'disabled', 'checked', 'selected', 'readonly', 'required', 'multiple',
  'autofocus', 'autoplay', 'controls', 'loop', 'muted', 'hidden', 'open',
  'novalidate', 'allowfullscreen', 'playsinline', 'default', 'reversed',
]);

const DEFAULTS = {
  componentName: 'Page',
  wrapper: 'fragment', // 'fragment' | 'div' — во что превратить корневой wrapper (body)
  cssImport: null,     // например './Page.css' -> добавит import в файл
  indent: '  ',
  skipScripts: true,
  // Кастомные типы: { 'my-type': (json, ctx) => 'jsx-строка' | null }
  handlers: {},
};

/* ---------------------------- helpers ---------------------------- */

const camel = (s) => s.replace(/[-:]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());

function escapeText(text) {
  return String(text).replace(/[{}<>]/g, (c) => `{'${c}'}`);
}

function parseStyle(str) {
  const decls = [];
  let cur = '';
  let paren = 0;
  let quote = null;
  for (const ch of str) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === ';' && !paren) {
      decls.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  decls.push(cur);

  return decls
    .map((d) => {
      const i = d.indexOf(':');
      if (i < 0) return null;
      const prop = d.slice(0, i).trim();
      const val = d.slice(i + 1).trim();
      if (!prop || !val) return null;
      // CSS-переменные остаются как есть, vendor prefix: -webkit-x -> WebkitX, -ms-x -> msX
      const key = prop.startsWith('--')
        ? JSON.stringify(prop)
        : prop.startsWith('-ms-')
          ? camel(prop.slice(1))
          : camel(prop.replace(/^-/, (m) => m).replace(/^-(\w)/, (_, c) => c.toUpperCase()));
      return `${key}: ${JSON.stringify(val)}`;
    })
    .filter(Boolean);
}

function styleToProp(style) {
  const parts = typeof style === 'string'
    ? parseStyle(style)
    : Object.entries(style || {}).map(([k, v]) => `${k.startsWith('--') ? JSON.stringify(k) : camel(k)}: ${JSON.stringify(String(v))}`);
  return parts.length ? `style={{ ${parts.join(', ')} }}` : '';
}

function classNames(classes) {
  if (!Array.isArray(classes)) return '';
  return classes
    .map((c) => (typeof c === 'string' ? c : c && c.active !== false && !c.private ? c.name : null))
    .filter(Boolean)
    .join(' ');
}

function attrToProp(name, value, tag) {
  const lower = name.toLowerCase();

  if (lower.startsWith('on')) return ''; // inline-обработчики не переносим
  if (lower === 'style') return styleToProp(value);

  let prop;
  if (lower.startsWith('data-') || lower.startsWith('aria-')) prop = lower;
  else if (ATTR_MAP[lower]) prop = ATTR_MAP[lower];
  else if (name.includes('-') || name.includes(':')) prop = camel(name); // svg: stroke-width, xlink:href
  else prop = name;

  // value/checked как defaultX только для форм; для остальных (li, option, button) оставляем value
  if (lower === 'value' && !['input', 'textarea', 'select'].includes(tag)) prop = 'value';

  if (value === true || (BOOL_ATTRS.has(lower) && (value === '' || value === lower))) return prop;
  if (value === false || value == null) return '';

  const str = String(value);
  return /["\n\r{}]/.test(str) ? `${prop}={${JSON.stringify(str)}}` : `${prop}="${str}"`;
}

function buildProps(json, tag) {
  const props = [];
  const attrs = { ...(json.attributes || {}) };
  const cls = classNames(json.classes);

  if (cls) {
    const existing = attrs.class;
    delete attrs.class;
    props.push(`className="${existing ? `${existing} ${cls}` : cls}"`);
  }
  for (const [k, v] of Object.entries(attrs)) {
    const p = attrToProp(k, v, tag);
    if (p) props.push(p);
  }
  return props;
}

/* ---------------------------- renderer ---------------------------- */

function render(json, ctx, depth) {
  const pad = ctx.opts.indent.repeat(depth);
  if (json == null) return '';

  // компонент может быть просто строкой (сырой текст)
  if (typeof json === 'string') return `${pad}${escapeText(json)}`;

  const type = json.type;

  // пользовательский хэндлер
  const custom = ctx.opts.handlers[type];
  if (custom) {
    const out = custom(json, { ...ctx, depth, pad, render: (c, d = depth) => render(c, ctx, d) });
    if (out != null) return out;
  }

  if (type === 'textnode') {
    const text = json.content ?? '';
    return text.trim() === '' ? '' : `${pad}${escapeText(text)}`;
  }

  if (type === 'comment') {
    const c = String(json.content ?? '').replace(/\*\//g, '* /');
    return `${pad}{/* ${c.trim()} */}`;
  }

  if (type === 'script' || json.tagName === 'script') {
    return ctx.opts.skipScripts ? '' : `${pad}{/* script skipped */}`;
  }

  // корневой wrapper (body)
  const isWrapper = type === 'wrapper';
  let tag = json.tagName || (isWrapper ? 'body' : 'div');

  const props = buildProps(json, tag);

  if (isWrapper) {
    if (ctx.opts.wrapper === 'fragment' && !props.length) {
      return renderChildren(json, ctx, depth, '<>', '</>', pad);
    }
    tag = 'div';
  }

  const open = `<${tag}${props.length ? ' ' + props.join(' ') : ''}`;

  if (VOID.has(tag)) return `${pad}${open} />`;

  // content — это innerHTML в GrapesJS (у text-компонентов без components)
  const hasChildren = Array.isArray(json.components) && json.components.length > 0;
  if (!hasChildren && typeof json.content === 'string' && json.content !== '') {
    const html = JSON.stringify(json.content);
    return `${pad}${open} dangerouslySetInnerHTML={{ __html: ${html} }} />`;
  }

  return renderChildren(json, ctx, depth, `${open}>`, `</${tag}>`, pad);
}

function renderChildren(json, ctx, depth, openTag, closeTag, pad) {
  const kids = (json.components || [])
    .map((c) => render(c, ctx, depth + 1))
    .filter((s) => s !== '');

  if (!kids.length) {
    return openTag === '<>' ? `${pad}<></>` : `${pad}${openTag.slice(0, -1)} />`;
  }

  // короткий чистый текст — в одну строку
  if (kids.length === 1 && !kids[0].includes('\n') && !kids[0].trim().startsWith('<')) {
    return `${pad}${openTag}${kids[0].trim()}${closeTag}`;
  }
  return `${pad}${openTag}\n${kids.join('\n')}\n${pad}${closeTag}`;
}

/* ---------------------------- public API ---------------------------- */

export function componentToJsx(json, options = {}) {
  const opts = { ...DEFAULTS, ...options, handlers: { ...DEFAULTS.handlers, ...(options.handlers || {}) } };
  const ctx = { opts };

  const body = render(json, ctx, 2);
  const imports = ["import React from 'react';"];
  if (opts.cssImport) imports.push(`import '${opts.cssImport}';`);

  return [
    imports.join('\n'),
    '',
    `export default function ${opts.componentName}() {`,
    '  return (',
    body,
    '  );',
    '}',
    '',
  ].join('\n');
}

export default function exportJsx(editor, pluginOptions = {}) {
  const getRootJson = (pageId) => {
    const data = editor.getProjectData();
    const pages = data.pages || [];
    const page = (pageId && pages.find((p) => p.id === pageId)) || pages[0];
    const frame = page && page.frames && page.frames[0];
    return frame && frame.component;
  };

  const getJsx = (opts = {}) => {
    const root = getRootJson(opts.pageId);
    const merged = { ...pluginOptions, ...opts };
    return {
      jsx: componentToJsx(root, merged),
      css: editor.getCss(),
    };
  };

  editor.getJsx = getJsx;
  editor.Commands.add('export-jsx', { run: (_ed, _sender, opts) => getJsx(opts) });
}
