/** Escapes text for HTML: names and notes come from users. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE = `
  body { color: #111; margin: 32px auto; max-width: 720px; line-height: 1.5; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 4px; } .sub { text-align: center; margin: 0 0 24px; color: #444; }
  h2 { font-size: 15px; margin: 20px 0 6px; } table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { padding: 6px 8px; border: 1px solid #999; vertical-align: top; } td:first-child { width: 40%; font-weight: bold; }
  ol { padding-left: 20px; } .sign { display: flex; justify-content: space-between; margin-top: 48px; text-align: center; }
  .sign div { width: 45%; } .sign p { margin: 0 0 72px; font-weight: bold; } .total { font-size: 18px; font-weight: bold; }
  @media print { body { margin: 0 auto; } }`;

/**
 * Opens a printable page and the browser's print dialog. The body is HTML the caller built with esc() around every
 * value; nothing is fetched, so the page prints what staff saw on screen.
 */
export function printDocument(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return false; // pop-ups blocked: the caller tells staff
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    return true;
}
