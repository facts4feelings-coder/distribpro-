const PRINT_CSS = `
  body { font-family: Arial, sans-serif; padding: 20px; }
  h1 { font-size: 20px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px; }
  th { background: #f1f5f9; }
  .text-right { text-align: right; }
  .font-bold { font-weight: bold; }
  input, button { display: none !important; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .card p { margin: 0; font-size: 12px; color: #666; }
  .card .val { font-size: 18px; font-weight: bold; color: #333; margin-top: 4px; }
  .section { margin-top: 16px; }
  .section h3 { font-size: 13px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .net-profit { font-size: 18px; font-weight: bold; padding: 12px; border: 2px solid #333; border-radius: 8px; margin-top: 16px; text-align: right; }
  .summary { margin-bottom: 16px; }
  .summary p { margin: 2px 0; }

  /* Tailwind utility bridges for printed report markup */
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-wrap { flex-wrap: wrap; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .justify-end { justify-content: flex-end; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .gap-6 { gap: 1.5rem; }
  .space-y-6 > * + * { margin-top: 1.5rem; }
  .space-y-4 > * + * { margin-top: 1rem; }
  .space-y-3 > * + * { margin-top: 0.75rem; }
  .space-y-2 > * + * { margin-top: 0.5rem; }
  .p-6 { padding: 1.5rem 0; }
  .p-5 { padding: 1.25rem 0; }
  .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
  .pt-3 { padding-top: 0.75rem; }
  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-3 { margin-top: 0.75rem; }
  .pb-2 { padding-bottom: 0.5rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-3 { margin-bottom: 0.75rem; }
  .border { border: none; }
  .border-b-2 { border-bottom: 1px solid #333; }
  .border-t { border-top: 1px solid #333; }
  .border-2 { border: none; }
  .rounded-xl { border-radius: 0; }
  .rounded-lg { border-radius: 0; }
  .text-sm { font-size: 12px; }
  .text-base { font-size: 14px; }
  .text-lg { font-size: 17px; }
  .text-2xl { font-size: 22px; }
  .text-3xl { font-size: 26px; }
  .tracking-wider { letter-spacing: 0.05em; }
  .uppercase { text-transform: uppercase; }
  .w-10 { width: 2.5rem; }
  .h-10 { height: 2.5rem; }
  .w-12 { width: 3rem; }
  .h-12 { height: 3rem; }
  .flex-shrink-0 { flex-shrink: 0; }
  .grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
  .lg\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
  .lg\\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .bg-white { background: none; }
  .text-slate-800 { color: #1e293b; }
  .text-slate-700 { color: #334155; }
  .text-slate-600 { color: #475569; }
  .text-slate-500 { color: #64748b; }
  .text-emerald-600 { color: #059669; }
  .text-rose-600 { color: #e11d48; }
  .border-slate-200 { border-color: #333; }
  .border-emerald-300 { border: none; }
  .border-rose-300 { border: none; }
  .bg-emerald-50 { background: none; }
  .bg-rose-50 { background: none; }
  .overflow-hidden { overflow: hidden; }
  .grid .card, .grid > div { border: none; padding: 0; }
  .grid .card p, .grid > div p { color: #333; }
  .grid .card .val, .grid > div .val { color: #000; }
  svg { display: none; }
  .w-10, .h-10, .w-12, .h-12 { display: none; }
`;

export function printHtml(title: string, bodyHtml: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }
  const done = () => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  if (doc.readyState === 'complete') {
    setTimeout(done, 100);
  } else {
    iframe.onload = () => setTimeout(done, 100);
  }
}
