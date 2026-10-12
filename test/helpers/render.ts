import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Compiles a generated module with Babel (classic runtime), runs it with the
 * real React and returns the HTML React renders. Imports are stripped: React
 * is injected, CSS imports are irrelevant here.
 */
export function renderModule(code: string): string {
  const out = transformSync(code, {
    babelrc: false,
    configFile: false,
    presets: [[presetReact, { runtime: 'classic' }]],
  });
  if (!out?.code) throw new Error('babel produced no code');
  const body = out.code
    .replace(/^import .*$/gm, '')
    .replace(/export default function (\w+)/, 'return function $1')
    .replace(/export function (\w+)/, 'return function $1');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function('React', body) as (r: typeof React) => React.FC;
  const errors: unknown[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const html = renderToStaticMarkup(React.createElement(factory(React)));
    if (errors.length) throw new Error(`React warnings: ${JSON.stringify(errors).slice(0, 500)}`);
    return html;
  } finally {
    console.error = orig;
  }
}

const BLOCK = /^(address|article|aside|blockquote|body|caption|dd|details|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|optgroup|option|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul|select|textarea|svg|path|g|circle|rect)$/;

function canonStyle(v: string): string {
  return v
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return `${d.slice(0, i).trim().toLowerCase()}:${d.slice(i + 1).trim()}`;
    })
    .sort()
    .join(';');
}

const BOOL = new Set(['checked', 'selected', 'disabled', 'controls', 'autoplay', 'loop', 'muted', 'allowfullscreen', 'readonly', 'required', 'multiple', 'hidden', 'open', 'playsinline']);

/**
 * Canonical form of rendered HTML: tags with sorted attributes, text with
 * collapsed whitespace, whitespace next to block boundaries removed (the
 * browser does not render it either). Comments dropped.
 */
export function canonHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const tokens: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      tokens.push((n.nodeValue ?? '').replace(/[ \t\n\r\f]+/g, ' '));
    } else if (n.nodeType === 1) {
      const e = n as Element;
      const tag = e.localName;
      const attrs = Array.from(e.attributes)
        .map((a) => {
          const name = a.name.toLowerCase();
          let v = a.value;
          if (name === 'style') v = canonStyle(v);
          if (BOOL.has(name)) v = '';
          return `${name}=${JSON.stringify(v)}`;
        })
        .sort();
      const block = BLOCK.test(tag);
      tokens.push(`${block ? '\u0001' : ''}<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${block ? '\u0001' : ''}`);
      e.childNodes.forEach(walk);
      if (tag === 'template') (e as HTMLTemplateElement).content.childNodes.forEach(walk);
      tokens.push(`${block ? '\u0001' : ''}</${tag}>${block ? '\u0001' : ''}`);
    }
  };
  tpl.content.childNodes.forEach(walk);
  return tokens
    .join('')
    .replace(/ +/g, ' ')
    .replace(/ ?\u0001 ?/g, '\u0001')
    .replace(/\u0001+/g, '\n')
    .trim();
}
