import { afterEach, describe, expect, it } from 'vitest';
import type { Component, Editor } from 'grapesjs';
import { assertValidJsx, createEditor, destroyEditor } from './helpers/editor';
import { componentToJsx, convertComponent, htmlToJsx } from '../src/convert';
import { componentToNodes, wrapperToNodes } from '../src/source/component';
import { resolveJsxOptions } from '../src/options';
import { exportPage } from '../src/export';
import type { JsxOptions } from '../src/types';

let editor: Editor;
afterEach(() => destroyEditor(editor));

const jsxOf = (opts: Partial<JsxOptions> = {}) => {
  const r = convertComponent(editor.getWrapper()!, opts);
  assertValidJsx(r.jsx);
  return r;
};

describe('regressions of the original JSON-based converter', () => {
  it('typed components keep their tag (link, image, video, table)', async () => {
    editor = await createEditor({
      components: `<a href="/x">x</a><img src="a.png" alt="A"><video src="v.mp4"></video>
        <table><tr><td colspan="2">t</td></tr></table>`,
    });
    const { markup } = jsxOf();
    expect(markup).toContain('<a href="/x">x</a>');
    expect(markup).toContain('<img src="a.png" alt="A" />');
    expect(markup).toMatch(/<video [^>]*src="v.mp4"[^>]* controls \/>/);
    expect(markup).toMatch(/<table>\s*<tbody>\s*<tr>\s*<td colSpan="2">t<\/td>/);
    expect(markup).not.toMatch(/<div (href|src)/);
  });

  it('YouTube video is exported as the iframe GrapesJS renders', async () => {
    editor = await createEditor({ components: '' });
    editor.addComponents({ type: 'video', provider: 'yt', videoId: 'abc123' });
    const { markup } = jsxOf();
    expect(markup).toMatch(/<iframe[^>]*src=\{?"https:\/\/www\.youtube\.com\/embed\/abc123/);
  });

  it('spaces between words and inline tags survive', async () => {
    editor = await createEditor({ components: '<p>Hello <b>world</b> and <i>more</i></p>' });
    expect(jsxOf().markup).toContain('<p>Hello <b>world</b> and <i>more</i></p>');
  });

  it('entities in text and attributes are not decoded twice', async () => {
    editor = await createEditor({ components: '<p>&amp;copy; {x}</p><a href="?a=1&amp;copy=2">l</a>' });
    const { markup } = jsxOf();
    expect(markup).toContain('{"&copy; {x}"}');
    expect(markup).toContain('href={"?a=1&copy=2"}');
  });

  it('component name is sanitised', async () => {
    editor = await createEditor({ components: '<div></div>' });
    expect(jsxOf({ componentName: 'my landing page' }).jsx).toContain('export default function MyLandingPage()');
  });

  it('exports the given page, not always the first one', async () => {
    editor = await createEditor({ components: '<h1>One</h1>' });
    const page = editor.Pages.add({ id: 'two', component: '<h2>Two</h2>' })!;
    editor.Pages.select(page);
    const r = exportPage(editor, {}, {});
    expect(r.jsx).toContain('<h2>Two</h2>');
    expect(exportPage(editor, {}, { pageId: editor.Pages.getAll()[0].id as string }).jsx).toContain('<h1>One</h1>');
  });
});

describe('handlers', () => {
  it('string -> raw JSX, false -> skipped, null -> default', async () => {
    editor = await createEditor({ components: '<a href="/a">a</a><img src="i.png"><p>keep</p>' });
    const { markup } = jsxOf({
      handlers: {
        link: (c: Component) => `<Link to=${JSON.stringify(c.getAttributes().href)}>\n  go\n</Link>`,
        image: () => false,
        text: () => null,
      },
    });
    expect(markup).toContain('<Link to="/a">');
    expect(markup).not.toContain('<img');
    expect(markup).toContain('<p>keep</p>');
  });

  it('a component element keeps its children and the spaces around it', async () => {
    editor = await createEditor({ components: '<p>Read <a href="/docs">the docs</a> now</p>' });
    const { markup } = jsxOf({
      handlers: { link: (c: Component, ctx) => ctx.el('Link', { to: c.getAttributes().href }, ctx.children()) },
    });
    expect(markup).toContain('<p>Read <Link to="/docs">the docs</Link> now</p>');
  });

  it('HNode result, with the default children', async () => {
    editor = await createEditor({ components: '<section class="card"><p>Body</p></section>' });
    const { markup } = jsxOf({
      handlers: {
        default: (c: Component, ctx) =>
          c.getClasses().includes('card') ? ctx.el('Card', { title: 'T' }, ctx.children()) : null,
      },
    });
    expect(markup).toContain('<Card title="T">');
    expect(markup).toContain('<p>Body</p>');
  });

  it('defaultNodes() and warn()', async () => {
    editor = await createEditor({ components: '<p>x</p>' });
    const r = jsxOf({
      handlers: {
        text: (_c, ctx) => {
          ctx.warn('custom note');
          return [ctx.el('div', { className: 'wrap' }, ctx.defaultNodes())];
        },
      },
    });
    expect(r.markup).toContain('<div className="wrap">');
    expect(r.warnings).toContain('custom note');
  });
});

describe('components that render themselves', () => {
  it('custom toHTML() is converted from its HTML', async () => {
    editor = await createEditor({
      plugins: [
        (ed) =>
          ed.Components.addType('my-widget', {
            model: {
              defaults: { tagName: 'div' },
              toHTML() {
                return '<div class="w"><span>Hi</span> <b>there</b></div>';
              },
            },
          }),
      ],
    });
    editor.addComponents({ type: 'my-widget' });
    expect(jsxOf().markup).toContain('<div className="w"><span>Hi</span> <b>there</b></div>');
  });

  it('`content` HTML is parsed into real JSX', async () => {
    editor = await createEditor({});
    editor.addComponents({ tagName: 'div', content: '<b>raw</b> text &amp; more' });
    expect(jsxOf().markup).toContain('<div><b>raw</b> text & more</div>');
  });

  it('without a DOM falls back to dangerouslySetInnerHTML with a warning', async () => {
    editor = await createEditor({});
    const [cmp] = editor.addComponents({ tagName: 'div', content: '<b>raw</b>' });
    const warnings: string[] = [];
    const nodes = componentToNodes(cmp, { options: resolveJsxOptions(), warn: (m) => warnings.push(m), parse: () => null });
    expect(nodes[0]).toMatchObject({ type: 'element', tag: 'div' });
    const { jsx } = (await import('../src/convert')).convertNodes(nodes);
    expect(jsx).toContain('dangerouslySetInnerHTML={{ __html: "<b>raw</b>" }}');
    expect(warnings).toHaveLength(1);
  });

  it('warns about component scripts (behaviour is not exported)', async () => {
    editor = await createEditor({
      plugins: [
        (ed) =>
          ed.Components.addType('ticker', {
            model: {
              defaults: {
                tagName: 'div',
                script() {
                  /* runs in the canvas */
                },
              },
            },
          }),
      ],
    });
    editor.addComponents({ type: 'ticker' });
    expect(jsxOf().warnings.some((w) => /script/.test(w))).toBe(true);
  });
});

describe('wrapper', () => {
  it('fragment by default, single child without fragment', async () => {
    editor = await createEditor({ components: '<main>x</main>' });
    expect(jsxOf().markup.trim()).toBe('<main>x</main>');
  });

  it('becomes a div when it has attributes', async () => {
    editor = await createEditor({ components: '<p>a</p><p>b</p>' });
    editor.getWrapper()!.addClass('page');
    const { markup } = jsxOf();
    expect(markup.trim().startsWith('<div className="page">')).toBe(true);
  });

  it("wrapper: 'div' always wraps", async () => {
    editor = await createEditor({ components: '<p>a</p>' });
    expect(jsxOf({ wrapper: 'div' }).markup.trim()).toBe('<div>\n      <p>a</p>\n    </div>');
  });

  it('wrapperToNodes returns the children', async () => {
    editor = await createEditor({ components: '<p>a</p>' });
    const nodes = wrapperToNodes(editor.getWrapper()!, { options: resolveJsxOptions(), warn: () => {} });
    expect(nodes).toMatchObject([{ type: 'element', tag: 'p' }]);
  });
});

describe('module options through the editor', () => {
  it('cssImport, exportType, reactImport, indent', async () => {
    editor = await createEditor({ components: '<p>a</p>' });
    const r = jsxOf({ componentName: 'Home', cssImport: true, exportType: 'named', reactImport: false, indent: '    ' });
    expect(r.jsx).toBe("import './Home.css';\n\nexport function Home() {\n    return (\n        <p>a</p>\n    );\n}\n");
  });

  it('componentToJsx works on any component', async () => {
    editor = await createEditor({ components: '<section><h1>T</h1></section>' });
    const section = editor.getWrapper()!.components().at(0);
    expect(componentToJsx(section)).toContain('<section>\n      <h1>T</h1>\n    </section>');
  });
});

describe('htmlToJsx', () => {
  it('converts arbitrary HTML and reports dropped things', () => {
    const code = htmlToJsx('<button onclick="go()" class="btn" style="color:red !important">Go</button><script>x()</script>');
    assertValidJsx(code);
    expect(code).toContain('<button className="btn" style={{ color: "red" }}>Go</button>');
    expect(code).not.toContain('script');
  });
});

describe('exportPage', () => {
  it('returns jsx, page css and files', async () => {
    editor = await createEditor({ components: '<p class="x">a</p>', style: '.x{color:red}' });
    const r = exportPage(editor, { componentName: 'Home', cssImport: true }, {});
    expect(r.componentName).toBe('Home');
    expect(r.css).toContain(".x {\n  color: red;\n}");
    expect(r.files.map((f) => f.name)).toEqual(['Home.jsx', 'Home.css']);
    expect(r.files[0].content).toBe(r.jsx);
    expect(r.jsx).toContain("import './Home.css';");
  });

  it('css only for the exported page', async () => {
    editor = await createEditor({ components: '<p class="one">a</p>', style: '.one{color:red}' });
    const page = editor.Pages.add({ id: 'p2', component: '<p class="two">b</p>', styles: '.two{color:blue}' })!;
    const css = exportPage(editor, {}, { pageId: page.id as string }).css;
    expect(css).toContain('.two');
    expect(css).not.toContain('.one');
  });

  it('no CSS file when there is no CSS', async () => {
    editor = await createEditor({ components: '<p>a</p>' });
    const r = exportPage(editor, {}, { cssOptions: { avoidProtected: true } });
    expect(r.files.map((f) => f.name)).toEqual(['Page.jsx']);
  });

  it('unknown page id throws', async () => {
    editor = await createEditor({ components: '<p>a</p>' });
    expect(() => exportPage(editor, {}, { pageId: 'nope' })).toThrow(/nope/);
  });
});
