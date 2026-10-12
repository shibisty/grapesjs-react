import { describe, expect, it } from 'vitest';
import type { JElement, JNode } from '../../src/core/nodes';
import { printNode } from '../../src/core/print';
import { assertValidJsx } from '../helpers/editor';

const opts = (printWidth = 80) => ({ indent: '  ', printWidth });
const e = (tag: string, children: JNode[] = [], props: JElement['props'] = []): JElement => ({ type: 'element', tag, props, children });
const t = (s: string): JNode => ({ type: 'text', text: s });
const SP: JNode = { type: 'expr', code: '{" "}' };
const valid = (code: string) => assertValidJsx(`const x = (\n${code}\n);`);

describe('printNode', () => {
  it('self-closes elements without children', () => {
    expect(printNode(e('div', [], [{ name: 'className', value: 'a' }]), opts(), 0)).toBe('<div className="a" />');
  });

  it('prints props: string, expression, bare, spread', () => {
    const out = printNode(
      e('input', [], [{ name: 'type', value: 'text' }, { name: 'tabIndex', expr: '0' }, { name: 'disabled' }, { name: '...', expr: '{ "@x": "1" }' }]),
      opts(),
      0
    );
    expect(out).toBe('<input type="text" tabIndex={0} disabled {...{ "@x": "1" }} />');
  });

  it('short mixed content stays on one line with plain spaces', () => {
    const out = printNode(e('p', [t('Hello'), SP, e('b', [t('world')]), SP, t('!')]), opts(), 1);
    expect(out).toBe('  <p>Hello <b>world</b> !</p>');
    valid(out);
  });

  it('long mixed content wraps; a space at a line end becomes {" "}', () => {
    const out = printNode(e('p', [t('aaaa bbbb cccc'), SP, e('b', [t('dddd')]), SP, t('eeee')]), opts(18), 0);
    valid(out);
    expect(out.split('\n')).toEqual(['<p>', '  aaaa bbbb cccc{" "}', '  <b>dddd</b> eeee', '</p>']);
  });

  it('text wraps at its own spaces without {" "} (JSX joins text lines with a space)', () => {
    const out = printNode(e('p', [t('one two three four five six')]), opts(14), 0);
    expect(out.split('\n')).toEqual(['<p>', '  one two', '  three four', '  five six', '</p>']);
  });

  it('block children go one per line', () => {
    const out = printNode(e('div', [e('h1', [t('T')]), e('p', [t('x')])]), opts(), 0);
    expect(out).toBe('<div>\n  <h1>T</h1>\n  <p>x</p>\n</div>');
  });

  it('multi-line children inside mixed content get their own lines', () => {
    const big = e('span', [e('b', [t('x'.repeat(30))]), e('i', [t('y'.repeat(30))])]);
    const out = printNode(e('p', [t('lead'), SP, big, SP, t('tail')]), opts(40), 0);
    valid(out);
    expect(out).toContain('lead{" "}');
    expect(out).toMatch(/<\/span>\{" "\}\n {2}tail/);
  });

  it('breaks long prop lists one per line', () => {
    const props = ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc'].map((n) => ({ name: n, value: 'v'.repeat(10) }));
    const out = printNode(e('div', [], props), opts(40), 0);
    expect(out.split('\n')).toEqual(['<div', '  aaaaaaaaaa="vvvvvvvvvv"', '  bbbbbbbbbb="vvvvvvvvvv"', '  cccccccccc="vvvvvvvvvv"', '/>']);
    valid(out);
  });

  it('fragments', () => {
    expect(printNode(e('', []), opts(), 0)).toBe('<></>');
    expect(printNode(e('', [e('a'), e('b')]), opts(), 0)).toBe('<>\n  <a />\n  <b />\n</>');
  });

  it('re-indents raw code', () => {
    const out = printNode(e('div', [{ type: 'raw', code: '    <Map\n      zoom={3}\n    />' }]), opts(), 0);
    expect(out).toBe('<div>\n  <Map\n    zoom={3}\n  />\n</div>');
  });
});
