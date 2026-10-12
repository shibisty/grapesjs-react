import { describe, expect, it } from 'vitest';
import { formatCss } from '../../src/core/css';

describe('formatCss', () => {
  it('one declaration per line, nested at-rules indented', () => {
    expect(formatCss('* { box-sizing: border-box; } body {margin: 0;}.a{color:red;padding:1px}@media (max-width: 768px){.a{color:blue}}')).toBe(
      [
        '* {',
        '  box-sizing: border-box;',
        '}',
        'body {',
        '  margin: 0;',
        '}',
        '.a {',
        '  color: red;',
        '  padding: 1px;',
        '}',
        '@media (max-width: 768px) {',
        '  .a {',
        '    color: blue;',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('does not touch strings, url() and comments', () => {
    const css = `.a{background:url(data:image/svg+xml;base64,AA==);content:"a;{b}";}/* x;{ */.b{font-family:'A B'}`;
    const out = formatCss(css);
    expect(out).toContain('background: url(data:image/svg+xml;base64,AA==);');
    expect(out).toContain('content: "a;{b}";');
    expect(out).toContain("/* x;{ */.b {");
    expect(out).toContain("font-family: 'A B';");
  });

  it('empty input', () => {
    expect(formatCss('')).toBe('');
    expect(formatCss('  ')).toBe('');
  });
});
