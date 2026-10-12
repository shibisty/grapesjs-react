/**
 * grapesjs-export-jsx
 * -------------------
 * Exports a GrapesJS page as a React component: `<Name>.jsx` + `<Name>.css`.
 *
 *   import grapesjs from 'grapesjs';
 *   import exportJsx from 'grapesjs-export-jsx';
 *   const editor = grapesjs.init({ plugins: [exportJsx], pluginsOpts: { [exportJsx]: { componentName: 'Landing' } } });
 *   const { jsx, css, warnings } = editor.runCommand('export-jsx');
 *
 * Without a bundler (UMD, global `grapesjsExportJsx`):
 *   grapesjs.init({ plugins: [grapesjsExportJsx.default] });
 */
import exportJsxPlugin from './plugin';

export default exportJsxPlugin;
export { exportJsxPlugin };
export { getJsx, COMMANDS, EVENTS } from './plugin';
export { componentToJsx, convertComponent, convertNodes, htmlToJsx } from './convert';
export type { ConvertResult } from './convert';
export { toComponentName } from './core/module';
export { DEFAULT_JSX_OPTIONS } from './options';
export { locales, SUPPORTED_LOCALES } from './i18n';
export type {
  ButtonOptions,
  ExportCallOptions,
  ExportFile,
  ExportJsxLabels,
  ExportJsxPluginOptions,
  HandlerContext,
  JsxExportResult,
  JsxHandler,
  JsxOptions,
  HNode,
  HElement,
  HText,
  HComment,
  HJsx,
  HAttrValue,
} from './types';
