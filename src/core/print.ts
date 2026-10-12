/**
 * JNode -> JSX source code. Pure, no DOM.
 *
 * Layout rules (close to what Prettier produces for JSX):
 *  - no children            -> `<tag a="b" />`
 *  - only text/expressions  -> one line if it fits `printWidth`
 *  - anything else          -> one child per line, indented
 *  - props on one line if they fit, otherwise one prop per line
 *
 * Children on separate lines are safe because `transform` already turned
 * every significant space into `{" "}`: JSX drops whitespace that contains a
 * line break, and that is exactly the formatting whitespace we add here.
 */
import type { JElement, JNode, JProp } from './nodes';

export interface PrintOptions {
  indent: string;
  printWidth: number;
}

function propCode(p: JProp): string {
  if (p.name === '...') return `{...${p.expr}}`;
  if (p.expr !== undefined) return `${p.name}={${p.expr}}`;
  if (p.value !== undefined) return `${p.name}="${p.value}"`;
  return p.name;
}

function reindent(code: string, pad: string): string {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  // Strip the common indentation, then apply ours.
  const nonEmpty = lines.filter((l) => l.trim());
  const common = nonEmpty.length ? Math.min(...nonEmpty.map((l) => l.match(/^[ \t]*/)![0].length)) : 0;
  return lines.map((l) => (l.trim() ? pad + l.slice(common) : '')).join('\n');
}

const SPACE_CODE = '{" "}';
const isSpace = (n: JNode): boolean => n.type === 'expr' && n.code === SPACE_CODE;

export function printNode(node: JNode, opts: PrintOptions, depth: number): string {
  const pad = opts.indent.repeat(depth);
  if (node.type === 'text') return pad + node.text;
  if (node.type === 'expr') return reindent(node.code, pad);
  if (node.type === 'raw') return reindent(node.code, pad);
  return printElement(node, opts, depth);
}

/** Separator before a unit: nothing, a real space, or a space inside one text. */
type Sep = 'none' | 'space' | 'soft';

interface Unit {
  code: string;
  sep: Sep;
  /** Multi-line element: printed on its own lines. */
  block?: JNode;
}

/**
 * Mixed inline content -> units for line filling. Text is split into words:
 * JSX joins text lines with a single space, so a text may wrap at any of its
 * spaces. A `{" "}` between a text and an element (or two elements) is a
 * "space" separator: a plain space while on one line, `{" "}` at a line end.
 */
function toUnits(children: JNode[], opts: PrintOptions): Unit[] {
  const units: Unit[] = [];
  let pending = 'none' as Sep;
  children.forEach((child) => {
    if (isSpace(child)) {
      if (!units.length) units.push({ code: SPACE_CODE, sep: 'none' });
      else pending = 'space';
      return;
    }
    if (child.type === 'text') {
      child.text.split(' ').filter(Boolean).forEach((word, k) => {
        units.push({ code: word, sep: k === 0 ? pending : 'soft' });
      });
      pending = 'none';
      return;
    }
    const flat = printNode(child, opts, 0);
    units.push(flat.includes('\n') ? { code: '', sep: pending, block: child } : { code: flat, sep: pending });
    pending = 'none';
  });
  if (pending === 'space') units.push({ code: SPACE_CODE, sep: 'none' });
  return units;
}

function fillLines(units: Unit[], opts: PrintOptions, depth: number): string[] {
  const pad = opts.indent.repeat(depth);
  const width = opts.printWidth - pad.length;
  const lines: string[] = [];
  let cur = '';
  let afterBlock = false;

  units.forEach((u) => {
    if (u.block) {
      if (cur) {
        lines.push(pad + cur + (u.sep === 'space' ? SPACE_CODE : ''));
        cur = '';
      } else if (afterBlock && u.sep === 'space') {
        lines[lines.length - 1] += SPACE_CODE;
      }
      lines.push(printNode(u.block, opts, depth));
      afterBlock = true;
      return;
    }
    if (!cur) {
      if (afterBlock && u.sep === 'space') lines[lines.length - 1] += SPACE_CODE;
      cur = u.code;
      afterBlock = false;
      return;
    }
    const joiner = u.sep === 'none' ? '' : ' ';
    if ((cur + joiner + u.code).length <= width) {
      cur += joiner + u.code;
    } else {
      lines.push(pad + cur + (u.sep === 'space' ? SPACE_CODE : ''));
      cur = u.code;
    }
  });
  if (cur) lines.push(pad + cur);
  return lines;
}

const hasText = (n: JNode): boolean => n.type === 'text' || (n.type === 'expr' && n.code.startsWith('{"'));

function printElement(node: JElement, opts: PrintOptions, depth: number): string {
  const pad = opts.indent.repeat(depth);
  const props = node.props.map(propCode);
  const tag = node.tag;

  const openFlat = `<${tag}${props.length ? ' ' + props.join(' ') : ''}`;
  const multiProps = props.length > 1 && pad.length + openFlat.length + 2 > opts.printWidth;
  const open = multiProps
    ? `<${tag}\n${props.map((p) => pad + opts.indent + p).join('\n')}\n${pad}`
    : openFlat;

  if (!node.children.length) {
    if (!tag) return `${pad}<></>`;
    return `${pad}${open}${multiProps ? '/>' : ' />'}`;
  }
  const close = `</${tag}>`;

  // Mixed content (any text): fill lines like prose.
  if (node.children.some(hasText)) {
    const units = toUnits(node.children, opts);
    if (!units.some((u) => u.block)) {
      const flat = units.map((u, i) => (i && u.sep !== 'none' ? ' ' : '') + u.code).join('');
      const line = `${pad}${open}>${flat}${close}`;
      if (!multiProps && line.length <= opts.printWidth) return line;
    }
    return `${pad}${open}>\n${fillLines(units, opts, depth + 1).join('\n')}\n${pad}${close}`;
  }

  // Block content: one child per line.
  const kids = node.children.map((c) => printNode(c, opts, depth + 1)).join('\n');
  return `${pad}${open}>\n${kids}\n${pad}${close}`;
}
