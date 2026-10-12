# grapesjs-export-jsx

GrapesJS plugin that exports a page as a **React component**: `Page.jsx` + `Page.css`.

- **Valid JSX** — every result is checked by the test suite with Babel and rendered with the real React: the HTML React produces equals the HTML GrapesJS exports.
- **Exactly the markup GrapesJS exports** — the converter walks the live component tree with the same `tagName` / `getAttrToHTML()` GrapesJS uses for `getHtml()`, so links stay `<a>`, videos keep `controls`, a YouTube video becomes its `<iframe>`, and components with their own `toHTML()` are converted from that HTML.
- **Whitespace is kept** — `Hello <b>world</b> and` does not turn into `Hello<b>world</b>and`; formatting newlines are dropped, visible spaces survive as text or `{" "}`.
- **React props** — `className`, `htmlFor`, `colSpan`, `tabIndex`, `strokeWidth` (SVG), `style={{ … }}`, booleans; `&copy;`-like text is not decoded twice.
- **Uncontrolled forms** — `value` / `checked` on inputs become `defaultValue` / `defaultChecked`, `<textarea>` text and `<option selected>` become `defaultValue`, so React shows no warnings.
- **Custom handlers** per component type to output your own components (`<Link>`, `<Map>`, …).
- **Export dialog** (Copy / Download), a panel button, commands, an event, 23 UI languages.

## Install

```sh
npm i grapesjs-export-jsx
```

```js
import grapesjs from 'grapesjs';
import exportJsx from 'grapesjs-export-jsx';

const editor = grapesjs.init({
  container: '#gjs',
  plugins: [exportJsx],
  pluginsOpts: {
    [exportJsx]: { componentName: 'Landing', cssImport: true },
  },
});

const { jsx, css, files, warnings } = editor.runCommand('export-jsx');
```

### Without a bundler

```html
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-export-jsx"></script>
<script>
  grapesjs.init({
    container: '#gjs',
    // the UMD build exposes { default, componentToJsx, htmlToJsx, ... } as window.grapesjsExportJsx
    plugins: [grapesjsExportJsx.default],
    pluginsOpts: { [grapesjsExportJsx.default]: { componentName: 'Landing' } },
  });
</script>
```

## Output

For a page with

```html
<section class="hero">
  <h1>Hello <b>React</b></h1>
  <p>A long paragraph is wrapped like Prettier would do it, and a space before a line break becomes <a href="/docs">an explicit space</a>.</p>
  <form><label for="n">Name</label> <input id="n" value="Ada"></form>
</section>
```

`{ componentName: 'Landing', cssImport: true }` gives `Landing.jsx`:

```jsx
import React from 'react';
import './Landing.css';

export default function Landing() {
  return (
    <section className="hero">
      <h1>Hello <b>React</b></h1>
      <p>
        A long paragraph is wrapped like Prettier would do it, and a space before a line break
        becomes <a href="/docs">an explicit space</a>.
      </p>
      <form><label htmlFor="n">Name</label> <input id="n" defaultValue="Ada" /></form>
    </section>
  );
}
```

and `Landing.css` with the page CSS, one declaration per line.

## Options

Converter options are accepted both as plugin options and per call (`editor.runCommand('export-jsx', { … })`).

| Option | Default | Description |
| --- | --- | --- |
| `componentName` | `'Page'` | Component and file name. Sanitised into a PascalCase identifier (`'my page'` → `MyPage`). |
| `cssImport` | `null` | `true` → `import './<Name>.css'`, a string → that path, `null`/`false` → no import. |
| `reactImport` | `true` | `import React from 'react'`. Not needed with the automatic JSX runtime (React 17+). |
| `exportType` | `'default'` | `'default'` → `export default function Page`, `'named'` → `export function Page`. |
| `wrapper` | `'fragment'` | Page root: `'fragment'` → `<>…</>` (a single child is returned as is; a `<div>` if the wrapper has attributes such as classes), `'div'` → always a `<div>`. |
| `indent` | `'  '` | Indentation unit (spaces or tabs). |
| `printWidth` | `100` | Line length the printer aims for. |
| `keepComments` | `true` | HTML comments become `{/* … */}`. |
| `prettyCss` | `true` | One CSS declaration per line (GrapesJS returns minified CSS). |
| `handlers` | `{}` | Custom conversion per component type, see below. |

Per call only:

| Option | Description |
| --- | --- |
| `pageId` | Page to export. Default: the selected page. |
| `cssOptions` | Passed to `editor.getCss()`, e.g. `{ avoidProtected: true }` to leave out `* { box-sizing: border-box; } body { margin: 0 }`. |

Plugin only:

| Option | Default | Description |
| --- | --- | --- |
| `button` | `true` | Panel button that opens the dialog. `{ panel: 'options', id: 'export-jsx' }` to place it elsewhere, `false` for none. Skipped if the panel does not exist. |
| `labels` | `{}` | Override UI texts (`buttonTitle`, `modalTitle`, `copy`, `copied`, `download`, `warnings`). |
| `injectCss` | `true` | Inject the dialog styles. |
| `extendEditor` | `true` | Define `editor.getJsx(options)` (kept from the first version of the plugin). |

## Commands, events, API

| | |
| --- | --- |
| `editor.runCommand('export-jsx', options?)` | Returns `{ jsx, css, files, warnings, componentName }`. |
| `editor.runCommand('export-jsx:open', options?)` | Opens the export dialog. |
| `editor.runCommand('export-jsx:download', options?)` | Downloads `<Name>.jsx` and `<Name>.css`. |
| `editor.on('export-jsx:export', result => …)` | After every export — e.g. to save the files on your server. |
| `getJsx(editor, options?)` | Same as the `export-jsx` command. |
| `componentToJsx(component, options?)` | Any component → module code (no plugin needed). |
| `convertComponent(component, options?)` | Same, with `{ jsx, markup, warnings, componentName }`. |
| `htmlToJsx(html, options?)` | Any HTML string → module code (needs a DOM). |

`warnings` lists what could not be carried over: component scripts (tabs, countdown, navbar burger — their markup is exported, their behaviour is not), `<script>` tags, inline `on*` handlers, `!important` in inline styles.

## Handlers

A handler receives the component and a context and returns:

- a **string** — JSX code inserted as is (re-indented);
- a **node** or an array of nodes built with `ctx.el(tag, attrs, children)` / `ctx.text(value)`;
- **`false`** — leave the component out;
- **`null` / `undefined`** — default conversion.

Plain components (no type) are addressed as `default`.

```js
pluginsOpts: {
  [exportJsx]: {
    handlers: {
      // <a href="/about"> -> <Link to="/about">
      link: (cmp, ctx) => ctx.el('Link', { to: cmp.getAttributes().href }, ctx.children()),
      // a custom map block -> your own component
      'my-map': (cmp) => `<Map lat={${cmp.get('lat')}} lng={${cmp.get('lng')}} />`,
      // wrap the default output
      default: (cmp, ctx) => (cmp.getClasses().includes('card') ? ctx.el('Card', {}, ctx.children()) : null),
    },
  },
}
```

Remember to add the imports of your components (`Link`, `Map`, `Card`) to the generated file.

## How it works

```
GrapesJS components ─┐
                     ├─► HTML tree ─► transform ─► JSX tree ─► print ─► module
HTML string (DOM) ───┘   (neutral)    (React rules,            (layout)  (imports,
                                       whitespace)                        function)
```

- `source/component.ts` — components → HTML tree (`tagName`, `getAttrToHTML()`, `content`, children; components with their own `toHTML()` go through the DOM parser).
- `source/dom.ts` — HTML string / DOM nodes → HTML tree (an inert `<template>`, nothing is executed).
- `core/transform.ts` — attribute → prop mapping, uncontrolled form fields, whitespace.
- `core/print.ts` — layout: short content on one line, prose filled up to `printWidth`, blocks one per line.
- `core/module.ts`, `core/css.ts`, `export.ts` — the module, the CSS file, pages.

## Migrating from `grapesjs-plugin-export-jsx.js`

- `editor.getJsx()` and the `export-jsx` command still work and return `{ jsx, css }` (plus `files`, `warnings`, `componentName`).
- The exported page is now the **selected** page, not always the first one.
- `componentToJsx()` takes a **component** instead of project JSON: the JSON does not contain the information needed for a correct export (see above).
- Handlers receive the component instead of its JSON and return nodes or JSX code.
- `skipScripts` is gone: scripts are never exported (React would not run them) and are reported in `warnings`.

## Development

```sh
npm install
npm run dev        # demo page with the plugin from src/
npm test           # vitest + jsdom + real grapesjs, Babel and React
npm run typecheck
npm run build      # dist/: ES + UMD + .d.ts
```

## License

MIT
