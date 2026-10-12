import { describe, expect, it } from 'vitest';
import { parseHtml } from '../src/source/dom';

describe('parseHtml', () => {
  it('keeps SVG case, decodes entities, keeps comments, does not run scripts', () => {
    (window as unknown as { __ran?: boolean }).__ran = false;
    const nodes = parseHtml('<svg viewBox="0 0 1 1"><linearGradient id="g"/></svg>a &amp; b<!--c--><script>window.__ran = true</script><img src=x onerror="window.__ran=true">')!;
    expect(nodes[0]).toMatchObject({ type: 'element', tag: 'svg', attrs: { viewBox: '0 0 1 1' }, children: [{ tag: 'linearGradient' }] });
    expect(nodes[1]).toEqual({ type: 'text', text: 'a & b' });
    expect(nodes[2]).toEqual({ type: 'comment', text: 'c' });
    expect((window as unknown as { __ran?: boolean }).__ran).toBe(false);
  });

  it('table fragments and template contents', () => {
    const nodes = parseHtml('<tr><td>x</td></tr><template><b>t</b></template>')!;
    expect(nodes[0]).toMatchObject({ tag: 'tr', children: [{ tag: 'td' }] });
    expect(nodes[1]).toMatchObject({ tag: 'template', children: [{ tag: 'b' }] });
  });

  it('returns null without a DOM', () => {
    expect(parseHtml('<b>x</b>', undefined as unknown as Document)).not.toBeNull(); // falls back to global document
    expect(parseHtml('<b>x</b>', {} as Document)).toBeNull();
  });
});
