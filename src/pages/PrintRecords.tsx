import { useEffect, useMemo, useState } from 'react';
import { Search, Printer, FileText, Ticket, Wallet, Undo2, ClipboardList, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate } from '@/lib/utils';
import PrintDocument from '@/components/PrintDocument';
import { PrintModal, PrintFormatSelector, normalizeFormat } from '@/components/PrintModal';
import type { PrintFormat } from '@/components/PrintModal';
import type {
  Customer, CustomerInvoice, CustomerInvoiceItem, Supplier, SupplierInvoice,
  SupplierInvoiceItem, PaymentVoucher, GatePass, Settings,
} from '@/lib/types';

type Category = 'sales' | 'sales-returns' | 'purchase-returns' | 'payment-vouchers' | 'gate-passes';

const CATEGORIES: { id: Category; label: string; icon: typeof FileText }[] = [
  { id: 'sales', label: 'Sales Invoices', icon: FileText },
  { id: 'sales-returns', label: 'Sales Returns', icon: Undo2 },
  { id: 'purchase-returns', label: 'Purchase Returns', icon: ClipboardList },
  { id: 'payment-vouchers', label: 'Payment Vouchers', icon: Wallet },
  { id: 'gate-passes', label: 'Gate Passes', icon: Ticket },
];

interface SaleRow {
  invoice: CustomerInvoice;
  customer: Customer | null;
  items: CustomerInvoiceItem[];
}
interface ReturnRow {
  invoice: SupplierInvoice;
  supplier: Supplier | null;
  items: SupplierInvoiceItem[];
}

export default function PrintRecords() {
  const { settings } = useSettings();
  const [category, setCategory] = useState<Category>('sales');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [salesReturns, setSalesReturns] = useState<ReturnRow[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<ReturnRow[]>([]);
  const [payments, setPayments] = useState<(PaymentVoucher & { customers?: Customer | null })[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);

  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [printDocs, setPrintDocs] = useState<{ key: string; node: React.ReactNode }[]>([]);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [salesRes, itemsRes, srRes, prRes, pvRes, gpRes] = await Promise.all([
        supabase.from('customer_invoices').select('*, customers(name, phone, address, city)').eq('invoice_type', 'sale').order('invoice_date', { ascending: false }).limit(500),
        supabase.from('customer_invoice_items').select('*').limit(5000),
        supabase.from('supplier_invoices').select('*, suppliers(name, phone, address, city)').eq('invoice_type', 'sales-return').order('invoice_date', { ascending: false }).limit(200),
        supabase.from('supplier_invoices').select('*, suppliers(name, phone, address, city)').eq('invoice_type', 'purchase-return').order('invoice_date', { ascending: false }).limit(200),
        supabase.from('payment_vouchers').select('*, customers(name)').order('voucher_date', { ascending: false }).limit(300),
        supabase.from('gate_passes').select('*').order('pass_date', { ascending: false }).limit(300),
      ]);

      const salesList = (salesRes.data ?? []) as unknown as (CustomerInvoice & { customers?: Customer[] | Customer })[];
      const itemsList = (itemsRes.data ?? []) as CustomerInvoiceItem[];
      const itemsByInvoice = new Map<string, CustomerInvoiceItem[]>();
      for (const it of itemsList) {
        const arr = itemsByInvoice.get(it.invoice_id) ?? [];
        arr.push(it);
        itemsByInvoice.set(it.invoice_id, arr);
      }

      const salesRows: SaleRow[] = salesList.map((inv) => ({
        invoice: inv,
        customer: Array.isArray(inv.customers) ? inv.customers[0] : inv.customers ?? null,
        items: itemsByInvoice.get(inv.id) ?? [],
      }));
      setSales(salesRows);

      const mapReturns = (rows: unknown): ReturnRow[] => {
        const list = (rows ?? []) as unknown as (SupplierInvoice & { suppliers?: Supplier[] | Supplier })[];
        return list.map((inv) => ({
          invoice: inv,
          supplier: Array.isArray(inv.suppliers) ? inv.suppliers[0] : inv.suppliers ?? null,
          items: [],
        }));
      };
      setSalesReturns(mapReturns(srRes.data));
      setPurchaseReturns(mapReturns(prRes.data));

      setPayments((pvRes.data ?? []) as (PaymentVoucher & { customers?: Customer | null })[]);
      setGatePasses((gpRes.data ?? []) as GatePass[]);
      setLoading(false);
    })();
  }, []);

  const matches = (text: string | null | undefined) =>
    text?.toLowerCase().includes(search.toLowerCase()) ?? false;

  const inDateRange = (d: string) =>
    (!fromDate || d >= fromDate) && (!toDate || d <= toDate);

  const visibleIds = useMemo(() => {
    switch (category) {
      case 'sales':
        return sales.filter(
          (r) => (matches(r.invoice.invoice_no) || matches(r.customer?.name)) && inDateRange(r.invoice.invoice_date)
        );
      case 'sales-returns':
        return salesReturns.filter(
          (r) => (matches(r.invoice.invoice_no) || matches(r.supplier?.name)) && inDateRange(r.invoice.invoice_date)
        );
      case 'purchase-returns':
        return purchaseReturns.filter(
          (r) => (matches(r.invoice.invoice_no) || matches(r.supplier?.name)) && inDateRange(r.invoice.invoice_date)
        );
      case 'payment-vouchers':
        return payments.filter(
          (r) => (matches(r.voucher_no) || matches(r.customers?.name)) && inDateRange(r.voucher_date)
        );
      case 'gate-passes':
        return gatePasses.filter(
          (r) => (matches(r.pass_no) || matches(r.customer_name)) && inDateRange(r.pass_date)
        );
    }
  }, [category, sales, salesReturns, purchaseReturns, payments, gatePasses, search, fromDate, toDate]);

  const totalAmount = useMemo(() => {
    if (!Array.isArray(visibleIds)) return 0;
    switch (category) {
      case 'sales':
      case 'sales-returns':
      case 'purchase-returns':
        return (visibleIds as SaleRow[] | ReturnRow[]).reduce((s, r) => s + r.invoice.total, 0);
      case 'payment-vouchers':
        return (visibleIds as (PaymentVoucher & { customers?: Customer | null })[]).reduce((s, r) => s + r.amount, 0);
      case 'gate-passes':
        return (visibleIds as GatePass[]).reduce((s, r) => s + r.total_amount, 0);
    }
  }, [visibleIds, category]);

  const openPrint = (docs: { key: string; node: React.ReactNode }[], format?: PrintFormat) => {
    if (docs.length === 0) return;
    setPrintDocs(docs);
    setPrintFormat(format ?? normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  const saleDoc = (row: SaleRow, settings_: Settings) => (
    <PrintDocument type="invoice" format={printFormat} data={{ settings: settings_, invoice: row.invoice, customer: row.customer ?? undefined, items: row.items }} />
  );
  const returnDoc = (type: 'sales-return' | 'purchase-return', row: ReturnRow, settings_: Settings) => (
    <PrintDocument type={type} format={printFormat} data={{ settings: settings_, invoice: row.invoice, supplier: row.supplier ?? undefined, items: row.items }} />
  );
  const paymentDoc = (row: PaymentVoucher & { customers?: Customer | null }, settings_: Settings) => (
    <PrintDocument type="payment-voucher" format={printFormat} data={{ settings: settings_, voucher: row, customer: row.customers ?? undefined }} />
  );
  const gatePassDoc = (row: GatePass, settings_: Settings) => (
    <PrintDocument type="gate-pass" format={printFormat} data={{ settings: settings_, gatePass: row }} />
  );

  const sym = settings?.currency_symbol ?? 'Rs';

  const renderRowActions = (onPrint: () => void) => (
    <div className="flex gap-1.5">
      <button
        onClick={onPrint}
        title="Preview & Print"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold transition-all"
      >
        <Eye size={14} /> Preview
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Print Records</h1>
        <p className="text-sm text-slate-500 mt-0.5">Search past records and print or preview any document</p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Search + date filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number or party name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Number</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Party</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Loading records...</td></tr>
              )}
              {!loading && Array.isArray(visibleIds) && visibleIds.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No records match your search</td></tr>
              )}
              {!loading && category === 'sales' && Array.isArray(visibleIds) && (visibleIds as SaleRow[]).map((row) => (
                <tr key={row.invoice.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.invoice.invoice_no}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.invoice.invoice_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customer?.name ?? 'Walk-in'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.invoice.total, sym)}</td>
                  <td className="px-4 py-3 text-right">
                    {renderRowActions(() => openPrint([{ key: row.invoice.id, node: saleDoc(row, settings!) }]))}
                  </td>
                </tr>
              ))}
              {!loading && (category === 'sales-returns' || category === 'purchase-returns') && Array.isArray(visibleIds) && (visibleIds as ReturnRow[]).map((row) => (
                <tr key={row.invoice.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.invoice.invoice_no}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.invoice.invoice_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.invoice.total, sym)}</td>
                  <td className="px-4 py-3 text-right">
                    {renderRowActions(() =>
                      openPrint([{ key: row.invoice.id, node: returnDoc(category === 'sales-returns' ? 'sales-return' : 'purchase-return', row, settings!) }])
                    )}
                  </td>
                </tr>
              ))}
              {!loading && category === 'payment-vouchers' && Array.isArray(visibleIds) && (visibleIds as (PaymentVoucher & { customers?: Customer | null })[]).map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.voucher_no}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.voucher_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.amount, sym)}</td>
                  <td className="px-4 py-3 text-right">
                    {renderRowActions(() => openPrint([{ key: row.id, node: paymentDoc(row, settings!) }]))}
                  </td>
                </tr>
              ))}
              {!loading && category === 'gate-passes' && Array.isArray(visibleIds) && (visibleIds as GatePass[]).map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.pass_no}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.pass_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customer_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.total_amount, sym)}</td>
                  <td className="px-4 py-3 text-right">
                    {renderRowActions(() => openPrint([{ key: row.id, node: gatePassDoc(row, settings!) }]))}
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && Array.isArray(visibleIds) && visibleIds.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">{visibleIds.length} record(s)</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(totalAmount, sym)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print preview modal */}
      {printOpen && settings && (
        <PrintModal open onClose={() => setPrintOpen(false)} bulkCount={printDocs.length}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          {printDocs.map((d, idx) => (
            <div key={d.key} className={idx > 0 ? 'mt-6 pt-6 border-t-2 border-dashed border-slate-300' : ''}>
              {d.node}
            </div>
          ))}
        </PrintModal>
      )}
    </div>
  );
}
