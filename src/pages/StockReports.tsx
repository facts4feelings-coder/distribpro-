import { useEffect, useState, useCallback } from 'react';
import { Search, Download, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { api, productDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/types';

export default function StockReports() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.products.list().catch(() => []);
    setProducts(data.map(productDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalStockValue = products.reduce((s, p) => s + p.stock_quantity * p.purchase_price, 0);
  const totalSaleValue = products.reduce((s, p) => s + p.stock_quantity * p.sale_price, 0);
  const lowStockItems = products.filter((p) => p.stock_quantity <= p.reorder_level);
  const outOfStock = products.filter((p) => p.stock_quantity <= 0);

  const exportCSV = () => {
    const headers = ['Name', 'SKU', 'Category', 'Unit', 'Purchase Price', 'Sale Price', 'Stock Qty', 'Stock Value', 'Reorder Level', 'Status'];
    const rows = filtered.map((p) => [
      p.name, p.sku ?? '', p.category ?? '', p.unit,
      p.purchase_price, p.sale_price, p.stock_quantity,
      (p.stock_quantity * p.purchase_price).toFixed(2),
      p.reorder_level,
      p.stock_quantity <= 0 ? 'Out of Stock' : p.stock_quantity <= p.reorder_level ? 'Low Stock' : 'In Stock',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Package size={20} className="text-emerald-600" /></div>
            <span className="text-sm text-slate-500">Total Products</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp size={20} className="text-emerald-600" /></div>
            <span className="text-sm text-slate-500">Stock Value (Cost)</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalStockValue, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><TrendingDown size={20} className="text-violet-600" /></div>
            <span className="text-sm text-slate-500">Stock Value (Sale)</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalSaleValue, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center"><AlertTriangle size={20} className="text-rose-600" /></div>
            <span className="text-sm text-slate-500">Low / Out of Stock</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{lowStockItems.length}<span className="text-sm text-slate-400 ml-2">({outOfStock.length} out)</span></p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" />
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Purchase Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Sale Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Stock Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Stock Value</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const stockValue = p.stock_quantity * p.purchase_price;
                  const isOut = p.stock_quantity <= 0;
                  const isLow = !isOut && p.stock_quantity <= p.reorder_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.category ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(p.purchase_price, sym)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">{formatCurrency(p.sale_price, sym)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{p.stock_quantity} {p.unit}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(stockValue, sym)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isOut ? 'bg-rose-100 text-rose-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">Total Stock Value (at cost):</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totalStockValue, sym)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
