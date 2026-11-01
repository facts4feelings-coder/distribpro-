import { useEffect, useState, useCallback } from 'react';
import { Calendar, Download, Printer, TrendingUp, FileText, Wallet, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CustomerInvoice, PaymentVoucher } from '@/lib/types';

interface DaySummary {
  date: string;
  invoiceCount: number;
  totalSales: number;
  totalPaid: number;
  totalDiscount: number;
  totalBalance: number;
  paymentCount: number;
  paymentAmount: number;
}

import { printHtml } from '@/lib/reportPrint';

export default function DailySalesSummary() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [days, setDays] = useState<DaySummary[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let invQuery = supabase.from('customer_invoices').select('invoice_date, total, paid_amount, discount, balance, invoice_type').eq('invoice_type', 'sale');
    let payQuery = supabase.from('payment_vouchers').select('voucher_date, amount');

    if (dateFrom) {
      invQuery = invQuery.gte('invoice_date', dateFrom);
      payQuery = payQuery.gte('voucher_date', dateFrom);
    }
    if (dateTo) {
      invQuery = invQuery.lte('invoice_date', dateTo);
      payQuery = payQuery.lte('voucher_date', dateTo);
    }

    const [invRes, payRes] = await Promise.all([invQuery, payQuery]);
    const invoices = (invRes.data ?? []) as (Pick<CustomerInvoice, 'invoice_date' | 'total' | 'paid_amount' | 'discount' | 'balance'> & { invoice_type: string })[];
    const payments = (payRes.data ?? []) as Pick<PaymentVoucher, 'voucher_date' | 'amount'>[];

    const dayMap = new Map<string, DaySummary>();

    invoices.forEach((inv) => {
      const date = inv.invoice_date;
      const existing = dayMap.get(date) ?? { date, invoiceCount: 0, totalSales: 0, totalPaid: 0, totalDiscount: 0, totalBalance: 0, paymentCount: 0, paymentAmount: 0 };
      existing.invoiceCount += 1;
      existing.totalSales += inv.total;
      existing.totalPaid += inv.paid_amount;
      existing.totalDiscount += inv.discount;
      existing.totalBalance += inv.balance;
      dayMap.set(date, existing);
    });

    payments.forEach((pv) => {
      const date = pv.voucher_date;
      const existing = dayMap.get(date) ?? { date, invoiceCount: 0, totalSales: 0, totalPaid: 0, totalDiscount: 0, totalBalance: 0, paymentCount: 0, paymentAmount: 0 };
      existing.paymentCount += 1;
      existing.paymentAmount += pv.amount;
      dayMap.set(date, existing);
    });

    const sorted = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    setDays(sorted);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const grandSales = days.reduce((s, d) => s + d.totalSales, 0);
  const grandPaid = days.reduce((s, d) => s + d.totalPaid, 0);
  const grandDiscount = days.reduce((s, d) => s + d.totalDiscount, 0);
  const grandBalance = days.reduce((s, d) => s + d.totalBalance, 0);
  const grandPayments = days.reduce((s, d) => s + d.paymentAmount, 0);
  const grandInvoiceCount = days.reduce((s, d) => s + d.invoiceCount, 0);

  const exportCSV = () => {
    const headers = ['Date', 'Invoices', 'Total Sales', 'Discount', 'Collected (Invoices)', 'Outstanding', 'Payments', 'Payment Amount'];
    const rows = days.map((d) => [d.date, d.invoiceCount, d.totalSales.toFixed(2), d.totalDiscount.toFixed(2), d.totalPaid.toFixed(2), d.totalBalance.toFixed(2), d.paymentCount, d.paymentAmount.toFixed(2)]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-sales-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('daily-summary-print')?.innerHTML ?? '';
    printHtml('Daily Sales Summary', `<h1>Daily Sales Summary</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="daily-summary-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Sales" value={formatCurrency(grandSales, sym)} color="bg-blue-50 text-blue-600" icon={<TrendingUp size={20} />} />
        <SummaryCard label="Total Collected" value={formatCurrency(grandPaid + grandPayments, sym)} color="bg-emerald-50 text-emerald-600" icon={<Wallet size={20} />} />
        <SummaryCard label="Outstanding" value={formatCurrency(grandBalance, sym)} color="bg-rose-50 text-rose-600" icon={<FileText size={20} />} />
        <SummaryCard label="Total Invoices" value={String(grandInvoiceCount)} color="bg-amber-50 text-amber-600" icon={<ShoppingCart size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
            <Printer size={18} /> Print
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : days.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No sales data for the selected period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Invoices</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total Sales</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Discount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Collected</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Outstanding</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Payments</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Payment Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{formatDate(d.date)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{d.invoiceCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(d.totalSales, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(d.totalDiscount, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(d.totalPaid, sym)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(d.totalBalance, sym)}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{d.paymentCount}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(d.paymentAmount, sym)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-700 text-right" colSpan={1}>Totals:</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{grandInvoiceCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(grandSales, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(grandDiscount, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(grandPaid, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(grandBalance, sym)}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{days.reduce((s, d) => s + d.paymentCount, 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(grandPayments, sym)}</td>
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
