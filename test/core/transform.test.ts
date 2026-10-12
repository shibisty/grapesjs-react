import { describe, expect, it } from 'vitest';
import { el, text, RAW_HTML_ATTR, type HNode, type JNode } from '../../src/core/nodes';
import { transformElement, transformRoot } from '../../src/core/transform';

const ctx = (keepComments = true) => {
  const warnings: string[] = [];
  return { keepComments, warn: (m: string) => warnings.push(m), warnings };
};

/** Compact notation of JSX children for assertions. */
const show = (nodes: JNode[]): string[] =>
  nodes.map((n) => (n.type === 'text' ? n.text : n.type === 'element' ? `<${n.tag}>` : n.type === 'expr' ? n.code : `raw:${n.code}`));

const kids = (children: HNode[], tag = 'p') => show(transformElement(el(tag, {}, children), ctx()).children);

describe('whitespace', () => {
  it('keeps spaces between text and inline elements as {" "}', () => {
    expect(kids([text('Hello '), el('b', {}, [text('world')]), text(' and')])).toEqual(['Hello', '{" "}', '<b>', '{" "}', 'and']);
  });

  it('keeps a whitespace-only node between two inline elements', () => {
    expect(kids([el('b'), text('\n   '), el('i')])).toEqual(['<b>', '{" "}', '<i>']);
  });

  it('drops formatting whitespace around and between blocks', () => {
    expect(kids([text('\n  '), el('div'), text('\n  '), el('p'), text('\n')], 'section')).toEqual(['<div>', '<p>']);
  });

  it('drops leading/trailing spaces at the edges of a block parent', () => {
    expect(kids([text('  Hello  ')])).toEqual(['Hello']);
  });

  it('keeps edge spaces inside an inline parent', () => {
    expect(kids([text(' x ')], 'span')).toEqual(['{" "}', 'x', '{" "}']);
  });

  it('collapses inner whitespace', () => {
    expect(kids([text('a \n\t  b')])).toEqual(['a b']);
  });

  it('merges adjacent text nodes', () => {
    expect(kids([text('a'), text(' '), text('b')])).toEqual(['a b']);
  });

  it('comments do not count as neighbours', () => {
    expect(kids([el('b'), text(' '), { type: 'comment', text: 'c' }, el('i')])).toEqual(['<b>', '{" "}', '{/* c */}', '<i>']);
  });

  it('text with JSX-special characters becomes a JS string, spaces included', () => {
    expect(kids([el('b'), text(' a < b {c} &amp; ')])).toEqual(['<b>', '{" a < b {c} &amp;"}']);
  });

  it('pre keeps whitespace exactly', () => {
    expect(kids([text('  a\n  b ')], 'pre')).toEqual(['{"  a\\n  b "}']);
  });

  it('ignores whitespace between SVG shapes but not inside <text>', () => {
    const svg = transformElement(el('svg', {}, [el('path'), text(' '), el('circle')]), ctx());
    expect(show(svg.children)).toEqual(['<path>', '<circle>']);
    const t = transformElement(el('svg', {}, [el('text', {}, [el('tspan'), text(' '), el('tspan')])]), ctx());
    expect(show((t.children[0] as { children: JNode[] }).children)).toEqual(['<tspan>', '{" "}', '<tspan>']);
  });
});

describe('form fields become uncontrolled', () => {
  it('input value/checked -> defaultValue/defaultChecked', () => {
    const j = transformElement(el('input', { type: 'checkbox', value: 'on', checked: '' }), ctx());
    expect(j.props).toEqual([{ name: 'type', value: 'checkbox' }, { name: 'defaultValue', value: 'on' }, { name: 'defaultChecked' }]);
  });

  it('textarea text -> defaultValue, no children', () => {
    const j = transformElement(el('textarea', { name: 't' }, [text('a\nb')]), ctx());
    expect(j.children).toEqual([]);
    expect(j.props).toContainEqual({ name: 'defaultValue', expr: '"a\\nb"' });
  });

  it('select: selected option -> defaultValue on the select (also inside optgroup)', () => {
    const j = transformElement(
      el('select', {}, [el('option', { value: '1' }, [text('One')]), el('optgroup', {}, [el('option', { selected: '' }, [text(' Two ')])])]),
      ctx()
    );
    expect(j.props).toEqual([{ name: 'defaultValue', value: 'Two' }]);
    const json = JSON.stringify(j);
    expect(json).not.toMatch(/selected/i);
  });

  it('multiple select -> array defaultValue', () => {
    const j = transformElement(
      el('select', { multiple: '' }, [el('option', { value: 'a', selected: true }), el('option', { value: 'b' }), el('option', { value: 'c', selected: 'selected' })]),
      ctx()
    );
    expect(j.props).toContainEqual({ name: 'defaultValue', expr: '["a","c"]' });
  });

  it('value on other elements stays value', () => {
    const j = transformElement(el('li', { value: '3' }), ctx());
    expect(j.props).toEqual([{ name: 'value', value: '3' }]);
  });
});

describe('other rules', () => {
  it('skips <script> with a warning', () => {
    const c = ctx();
    const j = transformElement(el('div', {}, [el('script', {}, [text('x()')]), el('p')]), c);
    expect(show(j.children)).toEqual(['<p>']);
    expect(c.warnings[0]).toMatch(/script/);
  });

  it('drops comments when keepComments is false', () => {
    const j = transformElement(el('div', {}, [{ type: 'comment', text: 'x' }]), ctx(false));
    expect(j.children).toEqual([]);
  });

  it('comment text cannot close the JSX comment early', () => {
    const j = transformElement(el('div', {}, [{ type: 'comment', text: ' a */ b ' }]), ctx());
    expect(show(j.children)).toEqual(['{/* a * / b */}']);
  });

  it('void elements never get children', () => {
    expect(transformElement(el('img', {}, [text('x')]), ctx()).children).toEqual([]);
  });

  it('raw inner HTML -> dangerouslySetInnerHTML', () => {
    const j = transformElement(el('div', { [RAW_HTML_ATTR]: '<b>x</b>' }), ctx());
    expect(j.props).toEqual([{ name: 'dangerouslySetInnerHTML', expr: '{ __html: "<b>x</b>" }' }]);
  });

  it('jsx nodes pass through as raw code', () => {
    const j = transformElement(el('div', {}, [{ type: 'jsx', code: '<Map />' }]), ctx());
    expect(show(j.children)).toEqual(['raw:<Map />']);
  });
});

describe('React components from handlers', () => {
  it('are not mistaken for HTML elements with the same name', () => {
    // `Link` is not the void <link>, `Script` is not <script>, `Input` gets no defaultValue.
    const j = transformElement(
      el('p', {}, [text('see '), el('Link', { to: '/x' }, [text('docs')]), text(' and '), el('Script'), el('Input', { value: 'v' })]),
      ctx()
    );
    expect(show(j.children)).toEqual(['see', '{" "}', '<Link>', '{" "}', 'and', '{" "}', '<Script>', '<Input>']);
    expect(show((j.children[2] as { children: JNode[] }).children)).toEqual(['docs']);
    expect((j.children[7] as { props: unknown[] }).props).toEqual([{ name: 'value', value: 'v' }]);
  });

  it('keep edge spaces inside (they may render inline content)', () => {
    expect(kids([text(' x ')], 'Card')).toEqual(['{" "}', 'x', '{" "}']);
  });
});

describe('transformRoot', () => {
  it('a single element is returned without a fragment', () => {
    expect(transformRoot([text('\n'), el('main'), text('\n')], ctx())).toMatchObject({ type: 'element', tag: 'main' });
  });

  it('several nodes are wrapped in a fragment', () => {
    expect(transformRoot([el('h1'), el('p')], ctx())).toMatchObject({ type: 'element', tag: '' });
  });

  it('empty input -> empty fragment', () => {
    expect(transformRoot([], ctx())).toEqual({ type: 'element', tag: '', props: [], children: [] });
  });
});
