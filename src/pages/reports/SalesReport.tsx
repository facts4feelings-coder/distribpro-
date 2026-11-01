import { useEffect, useState, useCallback } from 'react';
import { Search, Download, TrendingUp, Calendar, FileText, Printer } from 'lucide-react';
import { api, invoiceDtoToCustomerLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CustomerInvoice } from '@/lib/types';

import { printHtml } from '@/lib/reportPrint';

export default function SalesReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [invoices, setInvoices] = useState<(CustomerInvoice & { customers?: { name: string } })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const ds = await api.reports.dataset().catch(() => null);
    const data = (ds?.customerInvoices ?? [])
      .map(invoiceDtoToCustomerLegacy)
      .filter((i) => i.invoice_type === 'sale'
        && (!dateFrom || i.invoice_date >= dateFrom)
        && (!dateTo || i.invoice_date <= dateTo));
    setInvoices(data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter((inv) =>
    inv.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalSales = filtered.reduce((s, i) => s + i.total, 0);
  const totalPaid = filtered.reduce((s, i) => s + i.paid_amount, 0);
  const totalBalance = filtered.reduce((s, i) => s + i.balance, 0);
  const totalDiscount = filtered.reduce((s, i) => s + i.discount, 0);
  const totalTax = filtered.reduce((s, i) => s + i.tax, 0);

  const exportCSV = () => {
    const headers = ['Invoice No', 'Customer', 'Date', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status'];
    const rows = filtered.map((i) => [i.invoice_no, i.customers?.name ?? '', i.invoice_date, i.subtotal, i.discount, i.tax, i.total, i.paid_amount, i.balance, i.status]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('sales-report-print')?.innerHTML ?? '';
    printHtml('Sales Report', `<h1>Sales Report</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="sales-report-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Sales" value={formatCurrency(totalSales, sym)} color="bg-emerald-50 text-emerald-600" icon={<TrendingUp size={20} />} />
        <SummaryCard label="Total Collected" value={formatCurrency(totalPaid, sym)} color="bg-emerald-50 text-emerald-600" icon={<FileText size={20} />} />
        <SummaryCard label="Outstanding" value={formatCurrency(totalBalance, sym)} color="bg-rose-50 text-rose-600" icon={<FileText size={20} />} />
        <SummaryCard label="Total Discount" value={formatCurrency(totalDiscount, sym)} color="bg-amber-50 text-amber-600" icon={<FileText size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
            <Printer size={18} /> Print
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No sales found for the selected period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Invoice No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Subtotal</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Discount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Tax</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{inv.invoice_no}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(inv.subtotal, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(inv.discount, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(inv.tax, sym)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(inv.total, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(inv.paid_amount, sym)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(inv.balance, sym)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-bold text-slate-700 text-right">Totals:</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(filtered.reduce((s, i) => s + i.subtotal, 0), sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totalDiscount, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totalTax, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totalSales, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(totalPaid, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(totalBalance, sym)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
