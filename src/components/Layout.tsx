import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  Route,
  FileText,
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
  Menu,
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
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'quick-sale', label: 'Quick Sale', icon: ShoppingCart, group: 'Overview' },
  { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Transactions' },
  { id: 'returns', label: 'Returns', icon: Undo2, group: 'Transactions' },
  { id: 'payment-vouchers', label: 'Payment Recovery', icon: Wallet, group: 'Transactions' },
  { id: 'expense-vouchers', label: 'Expense Vouchers', icon: Banknote, group: 'Transactions' },
  { id: 'income-options', label: 'Other Income', icon: TrendingUpIcon, group: 'Transactions' },
  { id: 'gate-passes', label: 'Gate Passes', icon: Ticket, group: 'Transactions' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'Parties' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, group: 'Parties' },
  { id: 'products', label: 'Products & Stock', icon: Package, group: 'Inventory' },
  { id: 'routes', label: 'Routes & Shops', icon: Route, group: 'Inventory' },
  { id: 'reports', label: 'Reports', icon: BarChart3, group: 'Reports' },
  { id: 'print-records', label: 'Print Records', icon: Printer, group: 'Reports' },
  { id: 'salaries', label: 'Employee Salaries', icon: Users, group: 'Administration' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, group: 'Administration' },
];

const GROUPS = [...new Set(NAV_ITEMS.map((i) => i.group))];

function Logo() {
  return (
    <div className="flex items-center gap-3 px-5 h-[68px] border-b border-white/[0.06] flex-shrink-0">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
        <Package size={20} className="text-white" />
      </div>
      <div>
        <p className="font-extrabold text-white text-[15px] leading-tight tracking-tight">DistribPro</p>
        <p className="text-[11px] text-emerald-200/50 leading-tight font-medium">Distribution Manager</p>
      </div>
    </div>
  );
}

function NavList({
  current,
  permissions,
  permsLoading,
  onNavigate,
}: {
  current: PageId;
  permissions: string[] | null;
  permsLoading: boolean;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 py-4 space-y-5">
      {GROUPS.map((group) => {
        const items = NAV_ITEMS.filter(
          (i) => i.group === group && (permsLoading || hasPermission(permissions, i.id)),
        );
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = current === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13.5px] font-semibold transition-all ${
                      active
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

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
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const canQuickSale = permsLoading || hasPermission(permissions, 'quick-sale');

  const go = (page: PageId) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#F3F5F4] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[264px] flex-shrink-0 flex-col bg-gradient-to-b from-slate-950 via-[#0A1710] to-emerald-950 text-white">
        <Logo />
        <NavList current={current} permissions={permissions} permsLoading={permsLoading} onNavigate={go} />
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-sm uppercase">
              {(session?.username ?? 'a').slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session?.username ?? 'admin'}</p>
              <p className="text-[11px] text-slate-400 leading-tight">Signed in</p>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white transition-all"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[68px] flex-shrink-0 bg-white/85 backdrop-blur border-b border-slate-200/70 flex items-center justify-between gap-3 px-4 lg:px-8 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 transition-all"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] lg:text-lg font-bold text-slate-900 leading-tight truncate">
                {currentItem?.label ?? 'Dashboard'}
              </h1>
              <p className="text-[11px] lg:text-xs text-slate-400 font-medium leading-tight">
                {currentItem?.group ?? 'Overview'} · DistribPro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden lg:block text-[13px] text-slate-500 font-medium">{todayLabel}</span>
            {canQuickSale && current !== 'quick-sale' && current !== 'dashboard' && (
              <button
                onClick={() => go('quick-sale')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all"
              >
                <ShoppingCart size={16} />
                New Quick Sale
              </button>
            )}
            <button
              onClick={() => signOut()}
              className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</main>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-gradient-to-b from-slate-950 via-[#0A1710] to-emerald-950 text-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-300 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <NavList current={current} permissions={permissions} permsLoading={permsLoading} onNavigate={go} />
            <div className="p-3 border-t border-white/[0.06]">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition-all"
              >
                <LogOut size={17} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
