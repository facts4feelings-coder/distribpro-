import { useEffect, useState, useCallback } from 'react';
import { Download, Printer, TrendingUp, TrendingDown, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import type { CustomerInvoiceItem, ExpenseVoucher, SalaryPayment, IncomeOption } from '@/lib/types';

interface PLData {
  salesRevenue: number;
  salesDiscount: number;
  salesReturns: number;
  netSalesRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  expenseVouchers: number;
  salaryExpenses: number;
  totalOperatingExpenses: number;
  otherIncome: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  expenseBreakdown: { category: string; amount: number }[];
  incomeBreakdown: { category: string; amount: number }[];
}

import { printHtml } from '@/lib/reportPrint';

export default function FullProfitLossReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<PLData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    let salesQuery = supabase.from('customer_invoices').select('total, discount, paid_amount, balance, invoice_type, invoice_date');
    let returnsQuery = supabase.from('customer_invoices').select('total, discount, paid_amount, balance, invoice_type, invoice_date');
    let itemsQuery = supabase.from('customer_invoice_items').select('product_name, quantity, unit_price, total, product_id');
    let expQuery = supabase.from('expense_vouchers').select('*');
    let salQuery = supabase.from('salary_payments').select('*');
    let incQuery = supabase.from('income_options').select('*');
    const prodQuery = supabase.from('products').select('id, name, purchase_price, sale_price');

    if (dateFrom) {
      salesQuery = salesQuery.gte('invoice_date', dateFrom);
      returnsQuery = returnsQuery.gte('invoice_date', dateFrom);
      itemsQuery = itemsQuery.gte('created_at', dateFrom);
      expQuery = expQuery.gte('expense_date', dateFrom);
      salQuery = salQuery.gte('payment_date', dateFrom);
      incQuery = incQuery.gte('income_date', dateFrom);
    }
    if (dateTo) {
      salesQuery = salesQuery.lte('invoice_date', dateTo);
      returnsQuery = returnsQuery.lte('invoice_date', dateTo);
      itemsQuery = itemsQuery.lte('created_at', dateTo + 'T23:59:59');
      expQuery = expQuery.lte('expense_date', dateTo);
      salQuery = salQuery.lte('payment_date', dateTo);
      incQuery = incQuery.lte('income_date', dateTo);
    }

    const [salesRes, returnsRes, itemsRes, expRes, salRes, incRes, prodRes] = await Promise.all([
      salesQuery,
      returnsQuery,
      itemsQuery,
      expQuery,
      salQuery,
      incQuery,
      prodQuery,
    ]);

    const salesInvoices = ((salesRes.data ?? []) as { total: number; discount: number; invoice_date: string; invoice_type: string }[]).filter((i) => i.invoice_type === 'sale');
    const returnInvoices = ((returnsRes.data ?? []) as { total: number; discount: number; invoice_date: string; invoice_type: string }[]).filter((i) => i.invoice_type === 'sales_return');
    const salesItems = (itemsRes.data ?? []) as CustomerInvoiceItem[];
    const expenses = (expRes.data ?? []) as ExpenseVoucher[];
    const salaries = (salRes.data ?? []) as SalaryPayment[];
    const incomes = (incRes.data ?? []) as IncomeOption[];
    const products = (prodRes.data ?? []) as { id: string; name: string; purchase_price: number; sale_price: number }[];

    const productMap = new Map<string, number>();
    products.forEach((p) => productMap.set(p.id, p.purchase_price));

    const salesRevenue = salesInvoices.reduce((s, i) => s + i.total, 0);
    const salesDiscount = salesInvoices.reduce((s, i) => s + i.discount, 0);
    const salesReturns = returnInvoices.reduce((s, i) => s + i.total, 0);
    const netSalesRevenue = salesRevenue - salesReturns;

    const costOfGoodsSold = salesItems.reduce((s, item) => {
      const cost = item.product_id ? (productMap.get(item.product_id) ?? item.unit_price * 0.8) : item.unit_price * 0.8;
      return s + item.quantity * cost;
    }, 0);

    const grossProfit = netSalesRevenue - costOfGoodsSold;

    const expenseVouchersTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const salaryTotal = salaries.reduce((s, p) => s + p.amount, 0);
    const totalOperatingExpenses = expenseVouchersTotal + salaryTotal;

    const otherIncomeTotal = incomes.reduce((s, i) => s + i.amount, 0);

    const netProfit = grossProfit - totalOperatingExpenses + otherIncomeTotal;

    const expMap = new Map<string, number>();
    expenses.forEach((e) => expMap.set(e.category, (expMap.get(e.category) ?? 0) + e.amount));
    if (salaryTotal > 0) expMap.set('Salaries', salaryTotal);
    const expenseBreakdown = Array.from(expMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    const incMap = new Map<string, number>();
    incomes.forEach((i) => incMap.set(i.category, (incMap.get(i.category) ?? 0) + i.amount));
    const incomeBreakdown = Array.from(incMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    setData({
      salesRevenue, salesDiscount, salesReturns, netSalesRevenue,
      costOfGoodsSold, grossProfit,
      expenseVouchers: expenseVouchersTotal, salaryExpenses: salaryTotal, totalOperatingExpenses,
      otherIncome: otherIncomeTotal, netProfit,
      grossMargin: netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0,
      netMargin: netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0,
      expenseBreakdown, incomeBreakdown,
    });
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const rows: string[][] = [];
    rows.push(['PROFIT & LOSS REPORT']);
    rows.push([]);
    rows.push(['INCOME']);
    rows.push(['Total Sales Revenue', data.salesRevenue.toFixed(2)]);
    rows.push(['Less: Sales Returns', (-data.salesReturns).toFixed(2)]);
    rows.push(['Net Sales Revenue', data.netSalesRevenue.toFixed(2)]);
    rows.push([]);
    rows.push(['COST OF GOODS SOLD']);
    rows.push(['COGS', data.costOfGoodsSold.toFixed(2)]);
    rows.push([]);
    rows.push(['GROSS PROFIT', data.grossProfit.toFixed(2)]);
    rows.push(['Gross Margin %', data.grossMargin.toFixed(2) + '%']);
    rows.push([]);
    rows.push(['OPERATING EXPENSES']);
    data.expenseBreakdown.forEach((e) => rows.push([e.category, e.amount.toFixed(2)]));
    rows.push(['Total Operating Expenses', data.totalOperatingExpenses.toFixed(2)]);
    rows.push([]);
    rows.push(['OTHER INCOME']);
    data.incomeBreakdown.forEach((i) => rows.push([i.category, i.amount.toFixed(2)]));
    rows.push(['Total Other Income', data.otherIncome.toFixed(2)]);
    rows.push([]);
    rows.push(['NET PROFIT', data.netProfit.toFixed(2)]);
    rows.push(['Net Margin %', data.netMargin.toFixed(2) + '%']);

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-loss-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('pl-report-print')?.innerHTML ?? '';
    printHtml('Profit & Loss Report', `<h1>Profit & Loss Report</h1>${content}`);
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
        </div>
        <div className="p-8 text-center text-slate-400">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="pl-report-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PLCard label="Net Sales Revenue" value={formatCurrency(data.netSalesRevenue, sym)} color="bg-emerald-50 text-emerald-600" icon={<TrendingUp size={20} />} />
        <PLCard label="Gross Profit" value={formatCurrency(data.grossProfit, sym)} color={data.grossProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} icon={<DollarSign size={20} />} />
        <PLCard label="Total Expenses" value={formatCurrency(data.totalOperatingExpenses, sym)} color="bg-amber-50 text-amber-600" icon={<TrendingDown size={20} />} />
        <PLCard label="Net Profit" value={formatCurrency(data.netProfit, sym)} color={data.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} icon={<DollarSign size={20} />} />
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

      {/* P&L Statement */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-6 space-y-6">
        {/* Revenue section */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-3">Revenue</h3>
          <div className="space-y-2">
            <PLRow label="Total Sales Revenue" value={formatCurrency(data.salesRevenue, sym)} />
            <PLRow label="Less: Sales Returns" value={formatCurrency(-data.salesReturns, sym)} negative />
            <PLRow label="Net Sales Revenue" value={formatCurrency(data.netSalesRevenue, sym)} bold border />
          </div>
        </div>

        {/* COGS section */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-3">Cost of Goods Sold</h3>
          <div className="space-y-2">
            <PLRow label="COGS (based on purchase price)" value={formatCurrency(data.costOfGoodsSold, sym)} />
            <PLRow label="Gross Profit" value={formatCurrency(data.grossProfit, sym)} bold border highlight={data.grossProfit >= 0 ? 'positive' : 'negative'} />
            <PLRow label="Gross Margin" value={`${data.grossMargin.toFixed(1)}%`} muted />
          </div>
        </div>

        {/* Operating Expenses section */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-3">Operating Expenses</h3>
          <div className="space-y-2">
            {data.expenseBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No operating expenses recorded.</p>
            ) : (
              data.expenseBreakdown.map((e, i) => (
                <PLRow key={i} label={e.category} value={formatCurrency(e.amount, sym)} />
              ))
            )}
            <PLRow label="Total Operating Expenses" value={formatCurrency(data.totalOperatingExpenses, sym)} bold border negative />
          </div>
        </div>

        {/* Other Income section */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 pb-2 mb-3">Other Income</h3>
          <div className="space-y-2">
            {data.incomeBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No other income recorded.</p>
            ) : (
              data.incomeBreakdown.map((inc, i) => (
                <PLRow key={i} label={inc.category} value={formatCurrency(inc.amount, sym)} positive />
              ))
            )}
            <PLRow label="Total Other Income" value={formatCurrency(data.otherIncome, sym)} bold border positive />
          </div>
        </div>

        {/* Net Profit */}
        <div className={`p-5 rounded-xl border-2 ${data.netProfit >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight size={20} className={data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
              <span className="text-lg font-bold text-slate-800">NET PROFIT</span>
            </div>
            <span className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(data.netProfit, sym)}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-slate-500">Net Margin: <span className="font-bold text-slate-700">{data.netMargin.toFixed(1)}%</span></span>
            <span className="text-slate-500">Gross Margin: <span className="font-bold text-slate-700">{data.grossMargin.toFixed(1)}%</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PLCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
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

function PLRow({ label, value, bold, border, negative, positive, muted, highlight }: {
  label: string; value: string; bold?: boolean; border?: boolean; negative?: boolean; positive?: boolean; muted?: boolean; highlight?: 'positive' | 'negative';
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${border ? 'border-t border-slate-200 pt-3 mt-1' : ''}`}>
      <span className={`${bold ? 'font-bold text-slate-800' : muted ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}`}>{label}</span>
      <span className={`${bold ? 'text-base font-bold' : 'text-sm font-medium'} ${
        highlight === 'positive' ? 'text-emerald-600' : highlight === 'negative' ? 'text-rose-600' : negative ? 'text-rose-600' : positive ? 'text-emerald-600' : 'text-slate-700'
      }`}>{value}</span>
    </div>
  );
}
