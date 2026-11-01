import { useEffect, useState, useCallback } from 'react';
import { Download, Banknote, Wallet, Calendar, TrendingDown, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import type { ExpenseVoucher, SalaryPayment } from '@/lib/types';

import { printHtml } from '@/lib/reportPrint';

export default function ExpenseReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expenses, setExpenses] = useState<ExpenseVoucher[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<{ category: string; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let expQuery = supabase.from('expense_vouchers').select('*').order('expense_date', { ascending: false });
    let salQuery = supabase.from('salary_payments').select('*').order('payment_date', { ascending: false });
    if (dateFrom) {
      expQuery = expQuery.gte('expense_date', dateFrom);
      salQuery = salQuery.gte('payment_date', dateFrom);
    }
    if (dateTo) {
      expQuery = expQuery.lte('expense_date', dateTo);
      salQuery = salQuery.lte('payment_date', dateTo);
    }
    const [expRes, salRes] = await Promise.all([expQuery, salQuery]);
    const expData = (expRes.data ?? []) as ExpenseVoucher[];
    const salData = (salRes.data ?? []) as SalaryPayment[];
    setExpenses(expData);
    setSalaries(salData);

    const catMap = new Map<string, number>();
    expData.forEach((e) => catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount));
    const salTotal = salData.reduce((s, p) => s + p.amount, 0);
    if (salTotal > 0) catMap.set('Salaries', salTotal);
    setCategoryTotals(Array.from(catMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount));
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSalaries = salaries.reduce((s, p) => s + p.amount, 0);
  const grandTotal = totalExpenses + totalSalaries;

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type'];
    const rows: string[][] = [];
    expenses.forEach((e) => rows.push([e.expense_date, e.category, e.description ?? '', String(e.amount), 'Expense']));
    salaries.forEach((p) => rows.push([p.payment_date, 'Salaries', p.month, String(p.amount), 'Salary']));
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('expense-report-print')?.innerHTML ?? '';
    printHtml('Expense Summary', `<h1>Expense Summary</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="expense-report-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Voucher Expenses" value={formatCurrency(totalExpenses, sym)} color="bg-rose-50 text-rose-600" icon={<Banknote size={20} />} />
        <SummaryCard label="Salary Expenses" value={formatCurrency(totalSalaries, sym)} color="bg-amber-50 text-amber-600" icon={<Wallet size={20} />} />
        <SummaryCard label="Total Expenses" value={formatCurrency(grandTotal, sym)} color="bg-slate-100 text-slate-700" icon={<TrendingDown size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">Expense by Category</h3>
          </div>
          {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : categoryTotals.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No expenses found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {categoryTotals.map((c, i) => {
                const pct = grandTotal > 0 ? (c.amount / grandTotal) * 100 : 0;
                return (
                  <div key={i} className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">{c.category}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(c.amount, sym)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{pct.toFixed(1)}% of total</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent expenses list */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">Recent Expense Vouchers</h3>
          </div>
          {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : expenses.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No expenses found.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {expenses.slice(0, 20).map((e) => (
                <div key={e.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.voucher_no} — {e.category}</p>
                    <p className="text-xs text-slate-400">{e.expense_date}{e.paid_to ? ` • Paid to: ${e.paid_to}` : ''}</p>
                  </div>
                  <span className="font-bold text-rose-600">{formatCurrency(e.amount, sym)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
