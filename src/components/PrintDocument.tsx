import type { Settings, Customer, CustomerInvoiceItem } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrintFormat } from '@/components/PrintModal';

interface PrintData {
  settings: Settings;
  invoice?: {
    invoice_no: string;
    invoice_date: string;
    due_date: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    notes: string | null;
  };
  customer?: Customer;
  supplier?: { name: string; phone: string | null; address: string | null; city: string | null };
  items?: CustomerInvoiceItem[];
  voucher?: {
    voucher_no: string;
    supplier_id?: string | null;
    voucher_date: string;
    amount: number;
    payment_method: string;
    reference: string | null;
    notes: string | null;
  };
  gatePass?: {
    pass_no: string;
    pass_type: string;
    customer_name: string;
    pass_date: string;
    reference_invoice: string | null;
    items_description: string | null;
    total_amount: number;
    vehicle_no: string | null;
    driver_name: string | null;
    notes: string | null;
  };
  daySummary?: {
    date: string;
    entries: { name: string; amount: number }[];
    total: number;
  };
}

type PrintType = 'invoice' | 'supplier-invoice' | 'sales-return' | 'purchase-return' | 'payment-voucher' | 'gate-pass' | 'day-payment-summary';

export default function PrintDocument({
  type,
  format,
  data,
  isLast = false,
}: {
  type: PrintType;
  format: PrintFormat;
  data: PrintData;
  isLast?: boolean;
}) {
  const { settings } = data;
  const sym = settings.currency_symbol;

  const isThermal = format === 'thermal-58' || format === 'thermal-80';
  const thermalPx = format === 'thermal-58' ? 'w-[230px]' : 'w-[320px]';
  const widthClass = isThermal ? thermalPx : 'w-[210mm]';
  const padding = isThermal ? 'p-3' : 'p-8';

  const partyName = data.customer?.name ?? data.supplier?.name ?? '';
  const partyPhone = data.customer?.phone ?? data.supplier?.phone ?? null;
  const partyAddress = data.customer?.address ?? data.supplier?.address ?? null;
  const partyCity = data.customer?.city ?? data.supplier?.city ?? null;

  const divider = isLast ? '' : 'print-divider';

  if (type === 'gate-pass') {
    const gp = data.gatePass!;
    return (
      <div className={`${widthClass} ${padding} bg-white text-black mx-auto ${divider}`}>
        <div className={isThermal ? 'text-center' : 'flex justify-between items-start'}>
          <div>
            <h1 className="font-bold text-lg">{settings.company_name}</h1>
            <p className="text-xs">{settings.company_address}</p>
            <p className="text-xs">{settings.company_phone}</p>
          </div>
          {!isThermal && <div className="text-right"><h2 className="font-bold uppercase">Gate Pass</h2></div>}
        </div>
        {isThermal && <h2 className="font-bold text-center uppercase border-t border-b border-black my-2 py-1">Gate Pass</h2>}
        <div className="text-sm space-y-1 mt-4">
          <div className="flex justify-between"><span>Pass No:</span><span className="font-bold">{gp.pass_no}</span></div>
          <div className="flex justify-between"><span>Date:</span><span>{formatDate(gp.pass_date)}</span></div>
          <div className="flex justify-between"><span>Type:</span><span className="uppercase">{gp.pass_type}</span></div>
          <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{gp.customer_name}</span></div>
          {gp.vehicle_no && <div className="flex justify-between"><span>Vehicle:</span><span>{gp.vehicle_no}</span></div>}
          {gp.driver_name && <div className="flex justify-between"><span>Driver:</span><span>{gp.driver_name}</span></div>}
        </div>
        <div className="border-t border-black mt-2 pt-2">
          <p className="text-sm font-semibold">Items / Description:</p>
          {(() => {
            const lines = (gp.items_description ?? '').split('\n');
            const inSummary = lines[0]?.startsWith('ITEM SUMMARY:');
            if (!inSummary) return <p className="text-sm mt-1">{gp.items_description || '—'}</p>;
            const totalIdx = lines.findIndex((l) => l.startsWith('TOTAL ITEMS VALUE:'));
            const itemLines = lines.slice(1, totalIdx).filter(Boolean).map((l) => {
              const m = l.match(/^(.+) × ([\d.]+) = ([\d.]+)$/);
              return m ? { name: m[1], qty: m[2], value: parseFloat(m[3]) } : null;
            }).filter(Boolean) as { name: string; qty: string; value: number }[];
            return (
              <>
                <table className="w-full text-xs mt-1 border-collapse">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left py-0.5">Item</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemLines.map((it) => (
                      <tr key={it.name} className="border-b border-dashed border-gray-300">
                        <td className="py-0.5">{it.name}</td>
                        <td className="text-right">{it.qty}</td>
                        <td className="text-right">{formatCurrency(it.value, sym)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalIdx >= 0 && (
                  <div className="flex justify-between text-xs font-bold mt-1 border-t border-black pt-1">
                    <span>Total Items Value:</span>
                    <span>{lines[totalIdx].replace('TOTAL ITEMS VALUE: ', '')}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <div className="flex justify-between border-t border-black mt-2 pt-2 text-sm font-bold">
          <span>Total Amount:</span>
          <span>{formatCurrency(gp.total_amount, sym)}</span>
        </div>
        {!isThermal && (
          <div className="flex justify-between mt-12 text-xs">
            <div className="text-center"><div className="border-t border-black w-24 pt-1">Prepared By</div></div>
            <div className="text-center"><div className="border-t border-black w-24 pt-1">Authorized By</div></div>
            <div className="text-center"><div className="border-t border-black w-24 pt-1">Receiver Sign</div></div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'day-payment-summary') {
    const ds = data.daySummary!;
    return (
      <div className={`${widthClass} ${padding} bg-white text-black mx-auto ${divider}`} style={{ fontSize: isThermal ? undefined : '14px' }}>
        <div className={isThermal ? 'text-center' : 'flex justify-between items-start'}>
          <div>
            <h1 className="font-bold text-lg">{settings.company_name}</h1>
            <p className="text-xs">{settings.company_address}</p>
            <p className="text-xs">{settings.company_phone}</p>
          </div>
          {!isThermal && <div className="text-right"><h2 className="font-bold uppercase">Day Payment Summary</h2></div>}
        </div>
        {isThermal && <h2 className="font-bold text-center uppercase border-t border-b border-black my-2 py-1">Day Payment Summary</h2>}
        <div className="text-sm space-y-1 mt-4">
          <div className="flex justify-between"><span>Date:</span><span className="font-bold">{formatDate(ds.date)}</span></div>
          <div className="flex justify-between"><span>Total Receipts:</span><span className="font-bold">{ds.entries.length}</span></div>
        </div>
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">#</th>
              <th className="text-left py-1">Shop Keeper</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ds.entries.map((e, i) => (
              <tr key={`${e.name}-${i}`} className="border-b border-dashed border-gray-300">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{e.name}</td>
                <td className="py-1 text-right">{formatCurrency(e.amount, sym)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-black mt-4 pt-2">
          <div className="flex justify-between text-lg font-bold">
            <span>Total Received:</span>
            <span>{formatCurrency(ds.total, sym)}</span>
          </div>
        </div>
        <div className={`flex ${isThermal ? 'justify-center' : 'justify-between'} mt-12 text-xs`}>
          <div className="text-center"><div className="border-t border-black w-32 pt-1">Prepared By</div></div>
          {!isThermal && <div className="text-center"><div className="border-t border-black w-32 pt-1">Authorized Signature</div></div>}
        </div>
      </div>
    );
  }

  if (type === 'payment-voucher') {
    const v = data.voucher!;
    return (
      <div className={`${widthClass} ${padding} bg-white text-black mx-auto ${divider}`}>
        <div className={isThermal ? 'text-center' : 'flex justify-between items-start'}>
          <div>
            <h1 className="font-bold text-lg">{settings.company_name}</h1>
            <p className="text-xs">{settings.company_address}</p>
            <p className="text-xs">{settings.company_phone}</p>
          </div>
          {!isThermal && <div className="text-right"><h2 className="font-bold uppercase">Payment Receipt</h2></div>}
        </div>
        {isThermal && <h2 className="font-bold text-center uppercase border-t border-b border-black my-2 py-1">Payment Receipt</h2>}
        <div className="text-sm space-y-1 mt-4">
          <div className="flex justify-between"><span>Voucher No:</span><span className="font-bold">{v.voucher_no}</span></div>
          <div className="flex justify-between"><span>Date:</span><span>{formatDate(v.voucher_date)}</span></div>
          <div className="flex justify-between"><span>{v.supplier_id ? 'Paid To:' : 'Received From:'}</span><span className="font-bold">{partyName}</span></div>
          <div className="flex justify-between"><span>Payment Method:</span><span className="uppercase">{v.payment_method}</span></div>
          {v.reference && <div className="flex justify-between"><span>Reference:</span><span>{v.reference}</span></div>}
        </div>
        <div className="border-t border-black mt-4 pt-2">
          <div className="flex justify-between text-lg font-bold">
            <span>{v.supplier_id ? 'Amount Paid:' : 'Amount Received:'}</span>
            <span>{formatCurrency(v.amount, sym)}</span>
          </div>
        </div>
        {v.notes && <p className="text-sm mt-2">Notes: {v.notes}</p>}
        <div className={`flex ${isThermal ? 'justify-center' : 'justify-end'} mt-12 text-xs`}>
          <div className="text-center"><div className="border-t border-black w-32 pt-1">Received By</div></div>
        </div>
      </div>
    );
  }

  // Invoice or supplier invoice
  const inv = data.invoice!;
  const items = data.items ?? [];
  const title = type === 'supplier-invoice' ? 'Purchase Invoice' : type === 'sales-return' ? 'Sales Return' : type === 'purchase-return' ? 'Purchase Return' : 'Sales Invoice';
  const partyLabel = type === 'supplier-invoice' || type === 'purchase-return' ? 'Supplier' : 'Bill To';
  const prevBalance = data.customer?.current_balance ?? 0;
  const newBalance = prevBalance + inv.balance;

  if (isThermal) {
    return (
      <div className={`${thermalPx} ${padding} bg-white text-black mx-auto ${divider}`} style={{ fontFamily: 'monospace' }}>
        <div className="text-center">
          <h1 className="font-bold text-base">{settings.company_name}</h1>
          <p className="text-xs">{settings.company_address}</p>
          <p className="text-xs">{settings.company_phone}</p>
          <div className="border-t border-b border-black my-2 py-1">
            <h2 className="font-bold uppercase text-sm">{title}</h2>
          </div>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between"><span>Invoice:</span><span className="font-bold">{inv.invoice_no}</span></div>
          <div className="flex justify-between"><span>Date:</span><span>{formatDate(inv.invoice_date)}</span></div>
          <div className="flex justify-between"><span>{type === 'supplier-invoice' || type === 'purchase-return' ? 'Supplier' : 'Customer'}:</span><span className="font-bold">{partyName}</span></div>
          {partyPhone && <div className="flex justify-between"><span>Phone:</span><span>{partyPhone}</span></div>}
        </div>
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Disc</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-dashed border-gray-300">
                <td className="py-1">{item.product_name}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{item.unit_price.toFixed(2)}</td>
                <td className="text-right">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                <td className="text-right">{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs space-y-0.5 mt-2">
          <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(inv.subtotal, sym)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{formatCurrency(inv.discount, sym)}</span></div>}
          {inv.tax > 0 && <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(inv.tax, sym)}</span></div>}
          <div className="flex justify-between font-bold text-sm border-t border-black pt-1"><span>Total:</span><span>{formatCurrency(inv.total, sym)}</span></div>
          {inv.paid_amount > 0 && <div className="flex justify-between"><span>Paid:</span><span>{formatCurrency(inv.paid_amount, sym)}</span></div>}
          {prevBalance !== 0 && <div className="flex justify-between"><span>Previous Balance:</span><span>{formatCurrency(prevBalance, sym)}</span></div>}
          <div className="flex justify-between font-bold"><span>Balance:</span><span>{formatCurrency(inv.balance, sym)}</span></div>
          {prevBalance !== 0 && <div className="flex justify-between font-bold border-t border-black pt-1"><span>Total Balance:</span><span>{formatCurrency(newBalance, sym)}</span></div>}
        </div>
        <p className="text-center text-xs mt-4">{settings.invoice_footer_note || ''}</p>
      </div>
    );
  }

  // A4 / A5 elegant format
  const isA5 = format === 'a5';
  const amountInWords = (n: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const num = Math.floor(Math.abs(n));
    const paisa = Math.round((Math.abs(n) - num) * 100);
    const under100 = (x: number): string => {
      if (x < 20) return ones[x];
      const t = Math.floor(x / 10);
      const o = x % 10;
      return `${tens[t]}${o ? `-${ones[o]}` : ''}`;
    };
    const parts: string[] = [];
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = Math.floor((num % 1000) / 100);
    const rest = num % 100;
    if (crore) parts.push(`${under100(crore)} Crore`);
    if (lakh) parts.push(`${under100(lakh)} Lakh`);
    if (thousand) parts.push(`${under100(thousand)} Thousand`);
    if (hundred) parts.push(`${ones[hundred]} Hundred`);
    if (rest) parts.push(under100(rest));
    let words = parts.length ? parts.join(' ') : 'Zero';
    words += n < 0 ? ' Rupees (Negative)' : ' Rupees';
    if (paisa > 0) words += ` and ${under100(paisa)} Paisa`;
    return `${words} Only`;
  };

  return (
    <div className={`${widthClass} ${padding} bg-white text-black mx-auto ${divider}`} style={{ fontSize: isA5 ? '11px' : '13px', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Header band */}
      <div className="flex justify-between items-start pb-4 mb-4" style={{ borderBottom: '3px solid #111' }}>
        <div>
          <h1 className="font-bold" style={{ fontSize: isA5 ? '18px' : '24px', letterSpacing: '0.5px' }}>{settings.company_name}</h1>
          <p className="text-gray-600" style={{ lineHeight: 1.5 }}>{settings.company_address}</p>
          <p className="text-gray-600">{settings.company_phone}{settings.company_email ? ` · ${settings.company_email}` : ''}</p>
        </div>
        <div className="text-right">
          <h2 className="font-bold uppercase" style={{ fontSize: isA5 ? '14px' : '18px', letterSpacing: '2px' }}>{title}</h2>
          <p className="text-gray-500 uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '1.5px' }}>{type === 'supplier-invoice' || type === 'purchase-return' ? 'Supplier Document' : 'Original for Recipient'}</p>
        </div>
      </div>

      {/* Party + meta panel */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 rounded-lg p-3" style={{ background: '#f4f5f7' }}>
          <p className="uppercase font-semibold text-gray-500 mb-1" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '1px' }}>{partyLabel}</p>
          <p className="font-bold" style={{ fontSize: isA5 ? '13px' : '15px' }}>{partyName || '—'}</p>
          {partyPhone && <p className="text-gray-700">{partyPhone}</p>}
          {(partyAddress || partyCity) && <p className="text-gray-700">{[partyAddress, partyCity].filter(Boolean).join(', ')}</p>}
        </div>
        <div className="rounded-lg p-3 text-right" style={{ background: '#f4f5f7', minWidth: isA5 ? '150px' : '210px' }}>
          <div className="space-y-0.5">
            <div><span className="text-gray-500 uppercase" style={{ fontSize: isA5 ? '9px' : '10px' }}>No: </span><span className="font-bold">{inv.invoice_no}</span></div>
            <div><span className="text-gray-500 uppercase" style={{ fontSize: isA5 ? '9px' : '10px' }}>Date: </span>{formatDate(inv.invoice_date)}</div>
            {inv.due_date && <div><span className="text-gray-500 uppercase" style={{ fontSize: isA5 ? '9px' : '10px' }}>Due: </span>{formatDate(inv.due_date)}</div>}
          </div>
        </div>
      </div>

      {/* Items table */}
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#111', color: '#fff' }}>
            <th className="p-2 text-left font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px', width: '30px' }}>#</th>
            <th className="p-2 text-left font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px' }}>Product</th>
            <th className="p-2 text-right font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px' }}>Qty</th>
            <th className="p-2 text-right font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px' }}>Rate</th>
            <th className="p-2 text-right font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px' }}>Disc</th>
            <th className="p-2 text-right font-semibold uppercase" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '0.5px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ background: i % 2 === 1 ? '#f8f9fa' : 'transparent', borderBottom: '1px solid #e5e7eb' }}>
              <td className="p-2 text-gray-500">{i + 1}</td>
              <td className="p-2 font-medium">{item.product_name}</td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">{formatCurrency(item.unit_price, sym)}</td>
              <td className="p-2 text-right">{item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
              <td className="p-2 text-right font-semibold">{formatCurrency(item.total, sym)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={6} className="p-3 text-center text-gray-400">No items</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals + amount in words */}
      <div className="flex justify-between items-start mt-4 gap-6">
        <div className="flex-1 max-w-xs">
          <p className="uppercase font-semibold text-gray-500 mb-1" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '1px' }}>Amount in Words</p>
          <p className="italic text-gray-800" style={{ lineHeight: 1.5 }}>{amountInWords(inv.total)}</p>
          {inv.notes && (
            <div className="mt-3">
              <p className="uppercase font-semibold text-gray-500 mb-1" style={{ fontSize: isA5 ? '9px' : '10px', letterSpacing: '1px' }}>Notes</p>
              <p className="text-gray-700">{inv.notes}</p>
            </div>
          )}
        </div>
        <div className="rounded-lg p-3" style={{ background: '#f4f5f7', minWidth: isA5 ? '170px' : '230px' }}>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span>{formatCurrency(inv.subtotal, sym)}</span></div>
            {inv.discount > 0 && <div className="flex justify-between"><span className="text-gray-600">Discount:</span><span>-{formatCurrency(inv.discount, sym)}</span></div>}
            {inv.tax > 0 && <div className="flex justify-between"><span className="text-gray-600">Tax:</span><span>{formatCurrency(inv.tax, sym)}</span></div>}
          </div>
          <div className="flex justify-between font-bold mt-2 pt-2" style={{ borderTop: '2px solid #111', fontSize: isA5 ? '13px' : '15px' }}>
            <span>Total:</span><span>{formatCurrency(inv.total, sym)}</span>
          </div>
          {inv.paid_amount > 0 && <div className="flex justify-between mt-1"><span className="text-gray-600">Paid:</span><span className="font-semibold text-emerald-700">{formatCurrency(inv.paid_amount, sym)}</span></div>}
          {prevBalance !== 0 && <div className="flex justify-between mt-1"><span className="text-gray-600">Previous Balance:</span><span className="font-semibold">{formatCurrency(prevBalance, sym)}</span></div>}
          <div className="flex justify-between font-bold mt-1 px-2 py-1 rounded" style={{ background: inv.balance > 0 ? '#fdecec' : '#e8f7ef', color: inv.balance > 0 ? '#b91c1c' : '#047857' }}>
            <span>Balance Due:</span><span>{formatCurrency(inv.balance, sym)}</span>
          </div>
          {prevBalance !== 0 && (
            <div className="flex justify-between font-bold mt-1 px-2 py-1 rounded" style={{ background: newBalance > 0 ? '#fdecec' : '#e8f7ef', color: newBalance > 0 ? '#b91c1c' : '#047857' }}>
              <span>Total Balance (with previous):</span><span>{formatCurrency(newBalance, sym)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-16 text-xs">
        <div className="text-center"><div className="border-t border-black w-32 pt-1">Received By</div></div>
        <div className="text-center"><div className="border-t border-black w-32 pt-1">Authorized Signature</div></div>
      </div>
      {(settings.invoice_footer_note ?? 'Thank you for your business!') && (
        <p className="text-center text-gray-400 mt-6" style={{ fontSize: isA5 ? '9px' : '10px' }}>{settings.invoice_footer_note}</p>
      )}
    </div>
  );
}
