import { useEffect, useState, useCallback } from 'react';
import { Printer, Download, Store, Route as RouteIcon, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, dayName } from '@/lib/utils';
import { printHtml } from '@/lib/reportPrint';
import { exportToCSV } from '@/lib/csv';
import type { Route, Customer, CustomerRoute } from '@/lib/types';

interface RouteBalance {
  route: Route;
  shops: Customer[];
  totalReceivable: number;
  totalPayable: number;
}

export default function RouteBalanceReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customerRoutes, setCustomerRoutes] = useState<CustomerRoute[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'with-balance'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [r, c, cr] = await Promise.all([
      supabase.from('routes').select('*').order('sort_order'),
      supabase.from('customers').select('*').order('name'),
      supabase.from('customer_routes').select('*'),
    ]);
    setRoutes((r.data ?? []) as Route[]);
    setCustomers((c.data ?? []) as Customer[]);
    setCustomerRoutes((cr.data ?? []) as CustomerRoute[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shopMap = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const shopsByRoute = new Map<string, Customer[]>();
  for (const cr of customerRoutes) {
    const cust = shopMap.get(cr.customer_id);
    if (!cust) continue;
    if (!shopsByRoute.has(cr.route_id)) shopsByRoute.set(cr.route_id, []);
    shopsByRoute.get(cr.route_id)!.push(cust);
  }

  const report: RouteBalance[] = routes.map((route) => {
    let shops = shopsByRoute.get(route.id) ?? [];
    if (filter === 'with-balance') {
      shops = shops.filter((c) => Math.abs(c.current_balance) > 0.001);
    }
    const totalReceivable = shops.filter((c) => c.balance_type === 'receivable').reduce((s, c) => s + Math.max(0, c.current_balance), 0);
    const totalPayable = shops.filter((c) => c.balance_type === 'payable').reduce((s, c) => s + Math.max(0, c.current_balance), 0);
    return { route, shops, totalReceivable, totalPayable };
  });

  const grandReceivable = report.reduce((s, r) => s + r.totalReceivable, 0);
  const grandPayable = report.reduce((s, r) => s + r.totalPayable, 0);
  const totalShops = report.reduce((s, r) => s + r.shops.length, 0);

  const exportCSV = () => {
    const flat = report.flatMap((r) =>
      r.shops.map((c) => ({
        route: r.route.name,
        day: dayName(r.route.day_of_week),
        shop: c.name,
        shopkeeper: c.name,
        phone: c.phone ?? '',
        city: c.city ?? '',
        balance_type: c.balance_type,
        balance: c.current_balance,
      }))
    );
    exportToCSV(
      `route-wise-shopkeeper-balance-${new Date().toISOString().split('T')[0]}.csv`,
      flat,
      [
        { header: 'Route', key: 'route' },
        { header: 'Day', key: 'day' },
        { header: 'Shop', key: 'shop' },
        { header: 'Shopkeeper', key: 'shopkeeper' },
        { header: 'Phone', key: 'phone' },
        { header: 'City', key: 'city' },
        { header: 'Balance Type', key: 'balance_type' },
        { header: 'Balance', key: (row: typeof flat[number]) => String(row.balance) },
      ]
    );
  };

  const printReport = () => {
    const content = document.getElementById('route-balance-print')?.innerHTML ?? '';
    printHtml('Route-wise Shopkeeper Balance', `<h1>Route-wise Shopkeeper Balance Report</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="route-balance-print">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Store size={20} className="text-emerald-600" /></div>
            <span className="text-sm text-slate-500">Shops on Routes</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalShops}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Wallet size={20} className="text-emerald-600" /></div>
            <span className="text-sm text-slate-500">Total Receivable</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(grandReceivable, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center"><Wallet size={20} className="text-rose-600" /></div>
            <span className="text-sm text-slate-500">Total Payable</span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(grandPayable, sym)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'with-balance')} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500">
            <option value="all">All shops</option>
            <option value="with-balance">Only shops with balance</option>
          </select>
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

      {/* Route sections */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading...</div>
      ) : report.every((r) => r.shops.length === 0) ? (
        <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">No shops found on routes.</div>
      ) : (
        <div className="space-y-4">
          {report.filter((r) => r.shops.length > 0).map(({ route, shops, totalReceivable, totalPayable }) => (
            <div key={route.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <RouteIcon size={16} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-800">{route.name}</h3>
                  <span className="text-xs text-slate-500">{dayName(route.day_of_week)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500">{shops.length} shops</span>
                  <span className="font-bold text-emerald-600">Recv: {formatCurrency(totalReceivable, sym)}</span>
                  <span className="font-bold text-rose-600">Pay: {formatCurrency(totalPayable, sym)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">#</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Shop / Shopkeeper</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Phone</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">City</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shops.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{c.phone ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{c.city ?? '—'}</td>
                        <td className={`px-4 py-2 text-right font-bold ${
                          c.balance_type === 'payable' ? 'text-rose-600' : Math.abs(c.current_balance) < 0.001 ? 'text-slate-400' : 'text-emerald-600'
                        }`}>
                          {Math.abs(c.current_balance) < 0.001 ? '—' : formatCurrency(c.current_balance, sym)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
