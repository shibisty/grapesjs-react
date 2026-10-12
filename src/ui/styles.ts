/** Dialog styles. Class prefix: gjs-ejsx-. Colours follow the GrapesJS theme. */
export const STYLE_ID = 'gjs-ejsx-styles';

export const CSS = `
.gjs-ejsx { display: flex; flex-direction: column; gap: 12px; font-family: var(--gjs-main-font, Helvetica, sans-serif); font-size: 13px; }
.gjs-ejsx-file { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.gjs-ejsx-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gjs-ejsx-name { flex: 1 1 auto; min-width: 0; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gjs-ejsx-btn { cursor: pointer; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; padding: 4px 10px; font: inherit; color: inherit; background: rgba(255,255,255,0.08); }
.gjs-ejsx-btn:hover { background: rgba(255,255,255,0.16); }
.gjs-ejsx-btn:focus-visible { outline: 2px solid var(--gjs-color-highlight, #71b7f1); outline-offset: 1px; }
.gjs-ejsx-btn--done { border-color: #3ca25b; }
.gjs-ejsx-code { box-sizing: border-box; width: 100%; min-height: 120px; height: 38vh; resize: vertical; margin: 0; padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; background: rgba(0,0,0,0.25); color: inherit;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; tab-size: 2; overflow: auto; }
.gjs-ejsx-file--css .gjs-ejsx-code { height: 18vh; }
.gjs-ejsx-notes { border: 1px solid rgba(255,190,60,0.4); border-radius: 3px; padding: 6px 10px; }
.gjs-ejsx-notes summary { cursor: pointer; }
.gjs-ejsx-notes ul { margin: 6px 0 0; padding-inline-start: 18px; }
.gjs-ejsx-notes li { margin: 2px 0; overflow-wrap: anywhere; }
`;

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
