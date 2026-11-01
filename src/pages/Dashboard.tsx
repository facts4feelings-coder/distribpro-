import { useEffect, useState } from 'react';
import {
  Users, Truck, Package, FileText, Wallet, TrendingUp, AlertTriangle, Ticket,
  ShoppingCart, Route, BarChart3, ArrowRight, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import type { PageId } from '@/components/Layout';

export default function Dashboard({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [stats, setStats] = useState({
    customers: 0,
    suppliers: 0,
    products: 0,
    pendingInvoices: 0,
    receivable: 0,
    payable: 0,
    todayPayments: 0,
    lowStock: 0,
    gatePasses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, s, p, ci, si, pv, gp, ls] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('customer_invoices').select('balance').eq('status', 'unpaid').eq('invoice_type', 'sale'),
        supabase.from('supplier_invoices').select('balance').eq('status', 'unpaid').eq('invoice_type', 'purchase'),
        supabase.from('payment_vouchers').select('amount').gte('voucher_date', new Date().toISOString().split('T')[0]),
        supabase.from('gate_passes').select('*', { count: 'exact', head: true }).gte('pass_date', new Date().toISOString().split('T')[0]),
        supabase.from('products').select('name, stock_quantity, reorder_level'),
      ]);

      const receivable = (ci.data ?? []).reduce((sum, r) => sum + (r.balance || 0), 0);
      const payable = (si.data ?? []).reduce((sum, r) => sum + (r.balance || 0), 0);
      const todayPayments = (pv.data ?? []).reduce((sum, r) => sum + (r.amount || 0), 0);
      const lowStock = (ls.data ?? []).filter((p: { stock_quantity: number; reorder_level: number }) => p.stock_quantity <= p.reorder_level).length;

      setStats({
        customers: c.count ?? 0,
        suppliers: s.count ?? 0,
        products: p.count ?? 0,
        pendingInvoices: (ci.data ?? []).length,
        receivable,
        payable,
        todayPayments,
        lowStock,
        gatePasses: gp.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const netPosition = stats.receivable - stats.payable;

  const statCards = [
    { label: 'Customers', value: String(stats.customers), icon: Users, tone: 'text-sky-600 bg-sky-50 ring-sky-100', page: 'customers' as PageId },
    { label: 'Suppliers', value: String(stats.suppliers), icon: Truck, tone: 'text-teal-600 bg-teal-50 ring-teal-100', page: 'suppliers' as PageId },
    { label: 'Products', value: String(stats.products), icon: Package, tone: 'text-amber-600 bg-amber-50 ring-amber-100', page: 'products' as PageId },
    { label: 'Low Stock Items', value: String(stats.lowStock), icon: AlertTriangle, tone: 'text-orange-600 bg-orange-50 ring-orange-100', page: 'products' as PageId },
    { label: 'Pending Invoices', value: String(stats.pendingInvoices), icon: FileText, tone: 'text-rose-600 bg-rose-50 ring-rose-100', page: 'invoices' as PageId },
    { label: "Today's Gate Passes", value: String(stats.gatePasses), icon: Ticket, tone: 'text-violet-600 bg-violet-50 ring-violet-100', page: 'gate-passes' as PageId },
  ];

  const actions = [
    { label: 'Quick Sale', icon: ShoppingCart, page: 'quick-sale' as PageId, primary: true },
    { label: 'New Invoice', icon: FileText, page: 'invoices' as PageId },
    { label: 'Payment Voucher', icon: Wallet, page: 'payment-vouchers' as PageId },
    { label: 'Expense Voucher', icon: Wallet, page: 'expense-vouchers' as PageId },
    { label: 'Gate Pass', icon: Ticket, page: 'gate-passes' as PageId },
    { label: 'View Routes', icon: Route, page: 'routes' as PageId },
    { label: 'Stock Report', icon: BarChart3, page: 'reports' as PageId },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Greeting header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-sm text-slate-400 font-medium">{today}</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {greeting} <span className="text-slate-300">·</span> <span className="text-slate-500 font-semibold">Welcome back</span>
          </h1>
        </div>
        <button
          onClick={() => onNavigate('quick-sale')}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm"
        >
          <ShoppingCart size={16} />
          New Quick Sale
          <ArrowRight size={14} className="opacity-70" />
        </button>
      </div>

      {/* Financial hero strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-7 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-slate-700/30 blur-2xl" />
          <div className="absolute -bottom-14 -left-6 w-40 h-40 rounded-full bg-sky-500/10 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Net Position</p>
            <p className="mt-2 text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {loading ? '—' : formatCurrency(netPosition, sym)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 max-w-md">
              <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-slate-300">Receivable</p>
                <p className="mt-0.5 text-lg font-bold text-emerald-300">{loading ? '—' : formatCurrency(stats.receivable, sym)}</p>
              </div>
              <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-slate-300">Payable</p>
                <p className="mt-0.5 text-lg font-bold text-rose-300">{loading ? '—' : formatCurrency(stats.payable, sym)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 ring-1 ring-blue-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-slate-500">Today's Payments</p>
          </div>
          <div>
            <p className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">{loading ? '—' : formatCurrency(stats.todayPayments, sym)}</p>
            <p className="mt-1 text-xs text-slate-400">Collected across all routes today</p>
          </div>
          <button
            onClick={() => onNavigate('payment-vouchers')}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Record a payment <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onNavigate(card.page)}
              className="group bg-white rounded-xl border border-slate-200/80 p-4 lg:p-5 text-left hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all"
            >
              <div className={`w-10 h-10 rounded-lg ring-1 ${card.tone.split(' ')[1]} ${card.tone.split(' ')[2]} flex items-center justify-center`}>
                <Icon size={18} className={card.tone.split(' ')[0]} />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900 tracking-tight">{loading ? '—' : card.value}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-400">Frequent tasks, one tap away</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => onNavigate(a.page)}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
                  a.primary
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100'
                }`}
              >
                <Icon size={18} />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
