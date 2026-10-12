/** Browser helpers: download a file, copy text. */
import type { ExportFile } from '../types';

export function downloadFile(file: ExportFile, doc: Document = document): boolean {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const URL_ = view?.URL;
  if (!view || !URL_ || typeof URL_.createObjectURL !== 'function') return false;
  const blob = new view.Blob([file.content], { type: `${file.mime};charset=utf-8` });
  const url = URL_.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking right away cancels the download in some browsers.
  view.setTimeout(() => URL_.revokeObjectURL(url), 1000);
  return true;
}

/** Clipboard API, falling back to execCommand on a selected textarea. */
export async function copyText(text: string, fallbackField?: HTMLTextAreaElement | null): Promise<boolean> {
  const nav = (globalThis as { navigator?: Navigator }).navigator;
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission denied / insecure context: try the fallback */
  }
  if (!fallbackField) return false;
  try {
    fallbackField.focus();
    fallbackField.select();
    return fallbackField.ownerDocument.execCommand?.('copy') ?? false;
  } catch {
    return false;
  }
}
