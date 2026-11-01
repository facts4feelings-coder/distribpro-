import { useEffect, useState, useCallback } from 'react';
import { Download, AlertCircle, Clock, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO } from '@/lib/utils';
import type { CustomerInvoice, SupplierInvoice } from '@/lib/types';

import { printHtml } from '@/lib/reportPrint';

export default function ReceivablePayableReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<(CustomerInvoice & { customers?: { name: string } })[]>([]);
  const [payables, setPayables] = useState<(SupplierInvoice & { suppliers?: { name: string } })[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rec, pay] = await Promise.all([
      supabase.from('customer_invoices').select('*, customers(name)').eq('invoice_type', 'sale').gt('balance', 0).order('invoice_date'),
      supabase.from('supplier_invoices').select('*, suppliers(name)').eq('invoice_type', 'purchase').gt('balance', 0).order('invoice_date'),
    ]);
    setReceivables((rec.data ?? []) as (CustomerInvoice & { customers?: { name: string } })[]);
    setPayables((pay.data ?? []) as (SupplierInvoice & { suppliers?: { name: string } })[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = todayISO();
  const ageBuckets = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];

  const bucketize = (date: string) => {
    const diff = Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Current';
    if (diff <= 30) return '1-30 days';
    if (diff <= 60) return '31-60 days';
    if (diff <= 90) return '61-90 days';
    return '90+ days';
  };

  const recBuckets = ageBuckets.map((b) => ({
    bucket: b,
    amount: receivables.filter((r) => bucketize(r.invoice_date) === b).reduce((s, r) => s + r.balance, 0),
    count: receivables.filter((r) => bucketize(r.invoice_date) === b).length,
  }));
  const payBuckets = ageBuckets.map((b) => ({
    bucket: b,
    amount: payables.filter((p) => bucketize(p.invoice_date) === b).reduce((s, p) => s + p.balance, 0),
    count: payables.filter((p) => bucketize(p.invoice_date) === b).length,
  }));

  const totalRec = receivables.reduce((s, r) => s + r.balance, 0);
  const totalPay = payables.reduce((s, p) => s + p.balance, 0);
  const netCash = totalRec - totalPay;

  const exportCSV = () => {
    const headers = ['Type', 'Invoice No', 'Party', 'Date', 'Total', 'Paid', 'Balance', 'Age Bucket'];
    const rows: string[][] = [];
    receivables.forEach((r) => rows.push(['Receivable', r.invoice_no, r.customers?.name ?? '', r.invoice_date, String(r.total), String(r.paid_amount), String(r.balance), bucketize(r.invoice_date)]));
    payables.forEach((p) => rows.push(['Payable', p.invoice_no, p.suppliers?.name ?? '', p.invoice_date, String(p.total), String(p.paid_amount), String(p.balance), bucketize(p.invoice_date)]));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receivable-payable-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('recpay-report-print')?.innerHTML ?? '';
    printHtml('Receivable / Payable Report', `<h1>Receivable / Payable Report</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="recpay-report-print">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><AlertCircle size={20} className="text-emerald-600" /></div><span className="text-sm text-slate-500">Total Receivable</span></div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalRec, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center"><AlertCircle size={20} className="text-rose-600" /></div><span className="text-sm text-slate-500">Total Payable</span></div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalPay, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netCash >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}><Clock size={20} /></div><span className="text-sm text-slate-500">Net Cash Position</span></div>
          <p className={`text-2xl font-bold ${netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(netCash, sym)}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
          <Printer size={18} /> Print
        </button>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receivables aging */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <AlertCircle size={16} className="text-emerald-600" />
            <h3 className="font-bold text-slate-800">Receivables Aging</h3>
          </div>
          {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : (
            <div className="divide-y divide-slate-100">
              {recBuckets.map((b) => (
                <div key={b.bucket} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{b.bucket}</span>
                    <span className="text-xs text-slate-400 ml-2">({b.count} invoices)</span>
                  </div>
                  <span className={`font-bold ${b.bucket === '90+ days' && b.amount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(b.amount, sym)}</span>
                </div>
              ))}
              <div className="p-4 bg-slate-50 flex items-center justify-between border-t-2 border-slate-200">
                <span className="font-bold text-slate-700">Total Outstanding</span>
                <span className="font-bold text-emerald-600">{formatCurrency(totalRec, sym)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payables aging */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <h3 className="font-bold text-slate-800">Payables Aging</h3>
          </div>
          {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : (
            <div className="divide-y divide-slate-100">
              {payBuckets.map((b) => (
                <div key={b.bucket} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{b.bucket}</span>
                    <span className="text-xs text-slate-400 ml-2">({b.count} invoices)</span>
                  </div>
                  <span className={`font-bold ${b.bucket === '90+ days' && b.amount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(b.amount, sym)}</span>
                </div>
              ))}
              <div className="p-4 bg-slate-50 flex items-center justify-between border-t-2 border-slate-200">
                <span className="font-bold text-slate-700">Total Outstanding</span>
                <span className="font-bold text-rose-600">{formatCurrency(totalPay, sym)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding receivables */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50"><h3 className="font-bold text-slate-800">Outstanding Receivables</h3></div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Invoice</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receivables.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-400">No outstanding receivables.</td></tr>
                ) : receivables.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">{r.invoice_no}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.customers?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{formatDate(r.invoice_date)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatCurrency(r.balance, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outstanding payables */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50"><h3 className="font-bold text-slate-800">Outstanding Payables</h3></div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Invoice</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Supplier</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payables.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-400">No outstanding payables.</td></tr>
                ) : payables.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">{p.invoice_no}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{p.suppliers?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{formatDate(p.invoice_date)}</td>
                    <td className="px-3 py-2 text-right font-bold text-rose-600">{formatCurrency(p.balance, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
