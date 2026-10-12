/**
 * Minimal CSS pretty-printer for the exported file. GrapesJS returns the CSS
 * minified on one line; this puts one declaration per line. It only moves
 * whitespace — strings, comments and parentheses (`url(data:…;base64,…)`)
 * are copied as they are.
 */
export function formatCss(css: string, indent = '  '): string {
  const out: string[] = [];
  let line = '';
  let depth = 0;
  let quote: string | null = null;
  let parens = 0;

  // `color:red` -> `color: red` (the first colon of a declaration separates name and value).
  const decl = (t: string) => t.replace(/^([-\w]+)\s*:\s*/, '$1: ');

  const flush = () => {
    const t = line.trim();
    if (t) out.push(indent.repeat(depth) + t);
    line = '';
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      line += ch;
      if (ch === '\\' && i + 1 < css.length) line += css[++i];
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end < 0 ? css.length : end + 2;
      line += css.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      line += ch;
      continue;
    }
    if (ch === '(') parens++;
    if (ch === ')') parens = Math.max(0, parens - 1);
    if (parens > 0) {
      line += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (line && !line.endsWith(' ')) line += ' ';
      continue;
    }
    if (ch === '{') {
      line = line.trim() + ' {';
      flush();
      depth++;
      continue;
    }
    if (ch === ';') {
      line = decl(line.trim()) + ';';
      flush();
      continue;
    }
    if (ch === '}') {
      const t = line.trim();
      if (t) line = /[;}]$/.test(t) ? t : `${decl(t)};`;
      flush();
      depth = Math.max(0, depth - 1);
      out.push(indent.repeat(depth) + '}');
      continue;
    }
    line += ch;
  }
  flush();
  return out.length ? out.join('\n') + '\n' : '';
}
