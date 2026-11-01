import { type ReactNode } from 'react';
import { Printer, Layers, FileText } from 'lucide-react';

export type PrintFormat = 'thermal-58' | 'thermal-80' | 'a4' | 'a5';

export const PRINT_FORMATS: { value: PrintFormat; label: string }[] = [
  { value: 'thermal-58', label: 'Thermal 58mm' },
  { value: 'thermal-80', label: 'Thermal 80mm' },
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
];

export function PrintModal({
  open,
  onClose,
  children,
  bulkCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  bulkCount?: number;
}) {
  if (!open) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('print-area');
    if (!printContent) return;

    // Hidden iframe printing: same approach as report printing, which works in
    // both the browser and Electron. window.open() popups are unreliable there.
    const styleTags = Array.from(document.querySelectorAll('style')).map((s) => s.outerHTML).join('');
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => l.outerHTML)
      .join('');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><title>Print</title>${linkTags}${styleTags}` +
      `<style>@media print{body{margin:0;padding:8px}` +
      `.no-print{display:none!important}` +
      `body *{visibility:visible!important}` +
      `.print-divider{page-break-after:always}.print-divider:last-child{page-break-after:auto}` +
      `table{page-break-inside:auto}tr{page-break-inside:avoid}` +
      `@page{margin:8mm}}</style>` +
      `</head><body>${printContent.innerHTML}</body></html>`
    );
    doc.close();

    const doPrint = () => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    if (doc.readyState === 'complete') {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(() => {
        if (iframe.isConnected) doPrint();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Printer size={20} className="text-blue-600" />
            Print Preview
            {bulkCount > 1 && <span className="text-sm font-normal text-slate-500">({bulkCount} documents)</span>}
          </h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
              <Printer size={16} /> {bulkCount > 1 ? 'Print All' : 'Print'}
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-all">Close</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100" id="print-area">{children}</div>
      </div>
    </div>
  );
}

export function PrintFormatSelector({
  format,
  onChange,
}: {
  format: PrintFormat;
  onChange: (f: PrintFormat) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 no-print mb-4">
      {PRINT_FORMATS.map((f) => {
        const isActive = format === f.value;
        const isThermal = f.value.startsWith('thermal');
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {isThermal ? <Layers size={14} /> : <FileText size={14} />}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function normalizeFormat(value: string | undefined): PrintFormat {
  if (value === 'thermal') return 'thermal-80';
  if (value === 'thermal-58' || value === 'thermal-80' || value === 'a4' || value === 'a5') return value;
  return 'a4';
}
