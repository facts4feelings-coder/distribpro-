import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  Route,
  FileText,
  Receipt,
  Wallet,
  Banknote,
  Ticket,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  LogOut,
  X,
  BarChart3,
  ShoppingCart,
  Undo2,
  Printer,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions, hasPermission } from '@/hooks/usePermissions';

export type PageId =
  | 'dashboard'
  | 'customers'
  | 'suppliers'
  | 'products'
  | 'routes'
  | 'invoices'
  | 'quick-sale'
  | 'returns'
  | 'payment-vouchers'
  | 'expense-vouchers'
  | 'income-options'
  | 'gate-passes'
  | 'reports'
  | 'print-records'
  | 'salaries'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
  color: string;
  soft: string;
  text: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', color: 'bg-slate-700', soft: 'bg-slate-100', text: 'text-slate-700' },
  { id: 'quick-sale', label: 'Quick Sale', icon: ShoppingCart, group: 'Overview', color: 'bg-emerald-600', soft: 'bg-emerald-100', text: 'text-emerald-700' },
  { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Transactions', color: 'bg-blue-600', soft: 'bg-blue-100', text: 'text-blue-700' },
  { id: 'returns', label: 'Returns', icon: Undo2, group: 'Transactions', color: 'bg-rose-600', soft: 'bg-rose-100', text: 'text-rose-700' },
  { id: 'payment-vouchers', label: 'Payment Recovery', icon: Wallet, group: 'Transactions', color: 'bg-teal-600', soft: 'bg-teal-100', text: 'text-teal-700' },
  { id: 'expense-vouchers', label: 'Expense Vouchers', icon: Banknote, group: 'Transactions', color: 'bg-amber-500', soft: 'bg-amber-100', text: 'text-amber-700' },
  { id: 'income-options', label: 'Other Income', icon: TrendingUpIcon, group: 'Transactions', color: 'bg-lime-600', soft: 'bg-lime-100', text: 'text-lime-700' },
  { id: 'gate-passes', label: 'Gate Passes', icon: Ticket, group: 'Transactions', color: 'bg-violet-600', soft: 'bg-violet-100', text: 'text-violet-700' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'Parties', color: 'bg-sky-600', soft: 'bg-sky-100', text: 'text-sky-700' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, group: 'Parties', color: 'bg-orange-600', soft: 'bg-orange-100', text: 'text-orange-700' },
  { id: 'products', label: 'Products & Stock', icon: Package, group: 'Inventory', color: 'bg-yellow-500', soft: 'bg-yellow-100', text: 'text-yellow-700' },
  { id: 'routes', label: 'Routes & Shops', icon: Route, group: 'Inventory', color: 'bg-cyan-600', soft: 'bg-cyan-100', text: 'text-cyan-700' },
  { id: 'reports', label: 'Reports', icon: BarChart3, group: 'Reports', color: 'bg-indigo-600', soft: 'bg-indigo-100', text: 'text-indigo-700' },
  { id: 'print-records', label: 'Print Records', icon: Printer, group: 'Reports', color: 'bg-purple-700', soft: 'bg-purple-100', text: 'text-purple-700' },
  { id: 'salaries', label: 'Employee Salaries', icon: Users, group: 'Administration', color: 'bg-fuchsia-600', soft: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, group: 'Administration', color: 'bg-slate-600', soft: 'bg-slate-100', text: 'text-slate-700' },
];

const GROUPS = [...new Set(NAV_ITEMS.map((i) => i.group))];

export default function Layout({
  current,
  onNavigate,
  children,
}: {
  current: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}) {
  const { signOut, session } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { permissions, loading: permsLoading } = usePermissions(session?.id);

  const currentItem = NAV_ITEMS.find((i) => i.id === current);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top header bar */}
      <header className="flex-shrink-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 lg:px-6 z-30 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="font-bold text-white text-sm leading-tight">DistribPro</p>
            <p className="text-xs text-slate-400 leading-tight">Distribution Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:block text-sm text-slate-300 font-medium">
            {currentItem?.label ?? 'Dashboard'}
          </span>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Desktop tab bar — two rows */}
      <nav className="flex-shrink-0 hidden md:block bg-white border-b border-slate-200 relative z-20">
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0 px-2 py-1.5">
          {GROUPS.map((group, gi) => (
            <div key={group} className="flex items-center gap-0.5">
              {gi > 0 && <div className="w-px h-4 bg-slate-200 mx-1" />}
              {NAV_ITEMS.filter((i) => i.group === group && (permsLoading || hasPermission(permissions, i.id))).map((item) => {
                const Icon = item.icon;
                const active = current === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 w-20 py-2.5 rounded-lg transition-all ${
                      active
                        ? `${item.color} text-white shadow-sm`
                        : `${item.soft} hover:opacity-80`
                    }`}
                    title={item.label}
                  >
                    <Icon size={22} className={active ? 'text-white' : ''} />
                    <span className={`text-[11px] leading-tight font-semibold text-center ${active ? 'text-white' : ''}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile menu button */}
      <div className="flex-shrink-0 md:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">{currentItem?.label ?? 'Dashboard'}</span>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
        >
          <LayoutDashboard size={16} />
          Menu
        </button>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 bg-slate-900">
              <span className="text-white font-bold text-sm">Navigation</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-300 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 px-2">
              {GROUPS.map((group) => (
                <div key={group} className="mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">{group}</p>
                  <div className="space-y-0.5">
                    {NAV_ITEMS.filter((i) => i.group === group && (permsLoading || hasPermission(permissions, i.id))).map((item) => {
                      const Icon = item.icon;
                      const active = current === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            active ? `${item.color} text-white` : `${item.soft} ${item.text} hover:opacity-80`
                          }`}
                        >
                          <Icon size={17} className={active ? 'text-white' : ''} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
