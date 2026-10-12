import { describe, expect, it } from 'vitest';
import { attrToProp, needsExpression, parseStyle, propName, styleKey, styleObjectCode } from '../../src/core/props';

const ctx = (tag = 'div', inSvg = false) => {
  const warnings: string[] = [];
  return { tag, inSvg, warn: (m: string) => warnings.push(m), warnings };
};

describe('propName', () => {
  it.each([
    ['class', 'className'],
    ['for', 'htmlFor'],
    ['tabindex', 'tabIndex'],
    ['colspan', 'colSpan'],
    ['readonly', 'readOnly'],
    ['http-equiv', 'httpEquiv'],
    ['accept-charset', 'acceptCharset'],
    ['srcset', 'srcSet'],
    ['crossorigin', 'crossOrigin'],
    ['itemprop', 'itemProp'],
    ['xlink:href', 'xlinkHref'],
    ['xml:lang', 'xmlLang'],
    ['data-id', 'data-id'],
    ['aria-label', 'aria-label'],
    ['href', 'href'],
    ['viewBox', 'viewBox'],
  ])('%s -> %s', (attr, prop) => {
    expect(propName(attr, false)).toBe(prop);
  });

  it('camelCases hyphenated attributes only inside SVG', () => {
    expect(propName('stroke-width', true)).toBe('strokeWidth');
    expect(propName('fill-rule', true)).toBe('fillRule');
    // Custom attributes on HTML elements (Alpine, htmx, web components) stay as they are.
    expect(propName('x-data', false)).toBe('x-data');
    expect(propName('hx-get', false)).toBe('hx-get');
  });

  it('returns null for names JSX cannot express', () => {
    expect(propName('@click', false)).toBeNull();
    expect(propName(':href', false)).toBeNull();
    expect(propName('v-on:click', false)).toBeNull();
    expect(propName('x.y', false)).toBeNull();
  });
});

describe('style', () => {
  it('maps property names like React does', () => {
    expect(styleKey('background-color')).toBe('backgroundColor');
    expect(styleKey('-webkit-transition')).toBe('WebkitTransition');
    expect(styleKey('-moz-appearance')).toBe('MozAppearance');
    expect(styleKey('-ms-flex')).toBe('msFlex');
    expect(styleKey('--brand-color')).toBe('--brand-color');
    expect(styleKey('COLOR')).toBe('color');
  });

  it('parses declarations, ignoring semicolons inside url()/strings and comments', () => {
    const r = parseStyle(`color: red; background: url("a;b.png") no-repeat; /* c: d; */ content: 'x;y'`);
    expect(r.entries).toEqual([
      ['color', 'red'],
      ['background', 'url("a;b.png") no-repeat'],
      ['content', "'x;y'"],
    ]);
  });

  it('drops !important and reports it', () => {
    const r = parseStyle('color: red !important; margin:0');
    expect(r.entries).toEqual([['color', 'red'], ['margin', '0']]);
    expect(r.droppedImportant).toBe(true);
  });

  it('the last declaration of a property wins', () => {
    expect(parseStyle('color:red; margin:0; color:blue').entries).toEqual([['margin', '0'], ['color', 'blue']]);
  });

  it('accepts style objects', () => {
    expect(parseStyle({ 'font-size': '12px', '--x': 1 }).entries).toEqual([['fontSize', '12px'], ['--x', '1']]);
  });

  it('quotes keys that are not identifiers', () => {
    expect(styleObjectCode([['color', 'red'], ['--x', '1']])).toBe('{ color: "red", "--x": "1" }');
  });
});

describe('attrToProp', () => {
  it('boolean attributes become bare props', () => {
    expect(attrToProp('disabled', '', ctx())).toEqual({ name: 'disabled' });
    expect(attrToProp('disabled', 'disabled', ctx())).toEqual({ name: 'disabled' });
    expect(attrToProp('controls', true, ctx('video'))).toEqual({ name: 'controls' });
    expect(attrToProp('loop', false, ctx('video'))).toBeNull();
    expect(attrToProp('title', null, ctx())).toBeNull();
  });

  it('keeps empty non-boolean values', () => {
    expect(attrToProp('alt', '', ctx('img'))).toEqual({ name: 'alt', value: '' });
  });

  it('numbers become expressions', () => {
    expect(attrToProp('tabindex', 0, ctx())).toEqual({ name: 'tabIndex', expr: '0' });
  });

  it('drops inline event handlers with a warning', () => {
    const c = ctx('button');
    expect(attrToProp('onclick', 'go()', c)).toBeNull();
    expect(c.warnings[0]).toMatch(/onclick/);
  });

  it('strings with quotes, entities or newlines become JS strings', () => {
    expect(attrToProp('title', 'say "hi"', ctx())).toEqual({ name: 'title', expr: '"say \\"hi\\""' });
    expect(attrToProp('href', '?a=1&copy=2', ctx('a'))).toEqual({ name: 'href', expr: '"?a=1&copy=2"' });
    expect(attrToProp('href', '?a=1&b=2', ctx('a'))).toEqual({ name: 'href', expr: '"?a=1&b=2"' });
    expect(attrToProp('title', 'a & b', ctx())).toEqual({ name: 'title', value: 'a & b' });
  });

  it('invalid names are kept through a spread', () => {
    expect(attrToProp('@click', 'go', ctx())).toEqual({ name: '...', expr: '{ "@click": "go" }' });
  });

  it('style becomes an object and warns about !important', () => {
    const c = ctx();
    expect(attrToProp('style', 'color:red !important', c)).toEqual({ name: 'style', expr: '{ color: "red" }' });
    expect(c.warnings).toHaveLength(1);
    expect(attrToProp('style', '  ', ctx())).toBeNull();
  });

  it('needsExpression', () => {
    expect(needsExpression('plain')).toBe(false);
    expect(needsExpression('a&b')).toBe(true);
    expect(needsExpression('a & b')).toBe(false);
    expect(needsExpression('&#169;')).toBe(true);
    expect(needsExpression('C:\\path')).toBe(true);
  });
});
