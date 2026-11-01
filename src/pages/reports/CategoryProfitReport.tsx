import { useEffect, useState, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign, Percent, Printer, Layers } from 'lucide-react';
import { api, invoiceItemDtoToLegacy, productDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import { printHtml } from '@/lib/reportPrint';
import type { CustomerInvoiceItem } from '@/lib/types';

interface CategoryProfit {
  name: string;
  products: number;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export default function CategoryProfitReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categories, setCategories] = useState<CategoryProfit[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0, margin: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const ds = await api.reports.dataset().catch(() => null);
    const salesItems = (ds?.customerItems ?? [])
      .map(invoiceItemDtoToLegacy)
      .filter((i) => (!dateFrom || i.created_at >= dateFrom) && (!dateTo || i.created_at <= dateTo + 'T23:59:59'));
    const products = (ds?.products ?? []).map(productDtoToLegacy);

    const productMap = new Map(products.map((p) => [p.id, p]));

    const catMap = new Map<string, { products: Set<string>; qtySold: number; revenue: number; cost: number }>();

    salesItems.forEach((item) => {
      const prod = item.product_id ? productMap.get(item.product_id) : null;
      const catName = prod?.category?.trim() || 'Uncategorized';
      const existing = catMap.get(catName) ?? { products: new Set<string>(), qtySold: 0, revenue: 0, cost: 0 };
      existing.qtySold += item.quantity;
      existing.revenue += item.total;
      existing.cost += item.quantity * (prod?.purchase_price ?? item.unit_price * 0.8);
      if (item.product_id) existing.products.add(item.product_id);
      catMap.set(catName, existing);
    });

    const results = Array.from(catMap.entries()).map(([name, v]) => {
      const profit = v.revenue - v.cost;
      const margin = v.revenue > 0 ? (profit / v.revenue) * 100 : 0;
      return { name, products: v.products.size, qtySold: v.qtySold, revenue: v.revenue, cost: v.cost, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);

    setCategories(results);

    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
    const totalCost = results.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    setTotals({ revenue: totalRevenue, cost: totalCost, profit: totalProfit, margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0 });
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const headers = ['Category', 'Products Sold', 'Qty Sold', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    const rows = categories.map((c) => [c.name, c.products, c.qtySold, c.revenue.toFixed(2), c.cost.toFixed(2), c.profit.toFixed(2), c.margin.toFixed(2)]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `category-profit-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('category-profit-print')?.innerHTML ?? '';
    printHtml('Category Profit Report', `<h1>Category-wise Profit Report</h1>${content}`);
  };

  const bestCategory = categories.length > 0 ? categories.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;

  return (
    <div className="space-y-4" id="category-profit-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Revenue" value={formatCurrency(totals.revenue, sym)} color="bg-emerald-50 text-emerald-600" icon={<TrendingUp size={20} />} />
        <SummaryCard label="Total Cost" value={formatCurrency(totals.cost, sym)} color="bg-amber-50 text-amber-600" icon={<TrendingDown size={20} />} />
        <SummaryCard label="Net Profit" value={formatCurrency(totals.profit, sym)} color={totals.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} icon={<DollarSign size={20} />} />
        <SummaryCard label="Profit Margin" value={`${totals.margin.toFixed(1)}%`} color="bg-violet-50 text-violet-600" icon={<Percent size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : categories.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No sales data available for the selected period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Products</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Qty Sold</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Profit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <Layers size={15} className="text-emerald-500" /> {c.name}
                        {bestCategory?.name === c.name && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">TOP</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{c.products}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{c.qtySold}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(c.revenue, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(c.cost, sym)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${c.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(c.profit, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{c.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-700" colSpan={3}>Totals:</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totals.revenue, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totals.cost, sym)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totals.profit, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{totals.margin.toFixed(1)}%</td>
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
