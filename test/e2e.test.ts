import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from 'grapesjs';
import { assertValidJsx, createEditor, destroyEditor } from './helpers/editor';
import { canonHtml, renderModule } from './helpers/render';
import { convertComponent } from '../src/convert';

/**
 * End to end: GrapesJS page -> generated JSX -> Babel -> real React SSR.
 * What React renders must equal what GrapesJS itself exports as HTML
 * (canonical form: sorted attributes, browser-like whitespace).
 */
const FIXTURES: Record<string, string> = {
  inlineSpaces: `<p>Hello <b>world</b> and <i>more</i>, then <a href="/x">a link</a>.</p>`,
  spaceBetweenInline: `<p><b>bold</b> <i>italic</i><span> lead</span><span>trail </span>end</p>`,
  specialText: `<p>a &lt; b &amp;&amp; c &gt; d {curly} &amp;copy; done</p>`,
  longProse: `<p>${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6)}<b>bold tail</b> and <em>more emphasised words here</em> to wrap.</p>`,
  nestedBlocks: `<section class="hero"><div class="container"><h1>Title</h1><p>Sub <strong>title</strong></p></div></section>`,
  links: `<a href="?a=1&copy=2" title='say "hi"' target="_blank">x</a><a href="/y">y</a>`,
  image: `<img src="https://example.com/a.png" alt="A" width="10">`,
  video: `<video src="v.mp4"></video>`,
  table: `<table><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td rowspan="1">a</td><td>b</td></tr></tbody></table>`,
  form: `<form><label for="n">Name</label> <input id="n" name="n" value="Bob" maxlength="10">
    <input type="checkbox" checked> <input type="radio" name="r" value="1">
    <select name="s"><option value="1">One</option><option value="2" selected>Two</option></select>
    <select multiple name="m"><option selected>A</option><option>B</option><option selected>C</option></select>
    <textarea name="t">Hello
  world</textarea><button type="submit" disabled>Go</button></form>`,
  svg: `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path stroke-width="2" fill-rule="evenodd" d="M0 0L10 10"/><circle cx="5" cy="5" r="2"/></svg>`,
  pre: `<pre>  line 1
    line 2 {x} &lt;b&gt;</pre>`,
  lists: `<ul><li>One <b>1</b></li><li>Two</li></ul><ol start="3"><li>Three</li></ol>`,
  dataAria: `<div data-id="7" aria-label="Box" role="note" tabindex="0" contenteditable="false">x</div>`,
  emptyAndVoid: `<div></div><hr><br><span></span>`,
  textOnlyBreak: `<p>line<br>next line</p>`,
};

const ALL = Object.values(FIXTURES).join('\n');

describe('generated JSX renders to the same HTML as GrapesJS exports', () => {
  let editor: Editor;
  afterEach(() => destroyEditor(editor));

  for (const width of [100, 24]) {
    for (const [name, html] of Object.entries(FIXTURES)) {
      it(`${name} (printWidth ${width})`, async () => {
        editor = await createEditor({ components: html });
        const { jsx } = convertComponent(editor.getWrapper()!, { printWidth: width });
        assertValidJsx(jsx);
        const rendered = renderModule(jsx);
        expect(canonHtml(rendered)).toBe(canonHtml(editor.getHtml().replace(/^<body[^>]*>|<\/body>$/g, '')));
      });
    }
  }

  it('everything at once, printWidth 40', async () => {
    editor = await createEditor({ components: ALL });
    const { jsx } = convertComponent(editor.getWrapper()!, { printWidth: 40 });
    assertValidJsx(jsx);
    expect(canonHtml(renderModule(jsx))).toBe(canonHtml(editor.getHtml().replace(/^<body[^>]*>|<\/body>$/g, '')));
  });
});
