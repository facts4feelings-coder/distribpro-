import { useState } from 'react';
import { BarChart3, TrendingUp, PieChart, Scale, CalendarDays, Users, Package, FileBarChart, Target, Wallet, Layers } from 'lucide-react';
import SalesReport from '@/pages/reports/SalesReport';
import ProfitReport from '@/pages/reports/ProfitReport';
import CategoryProfitReport from '@/pages/reports/CategoryProfitReport';
import ExpenseReport from '@/pages/reports/ExpenseReport';
import ReceivablePayableReport from '@/pages/reports/ReceivablePayableReport';
import DailySalesSummary from '@/pages/reports/DailySalesSummary';
import CustomerSummaryReport from '@/pages/reports/CustomerSummaryReport';
import StockReports from '@/pages/StockReports';
import FullProfitLossReport from '@/pages/reports/FullProfitLossReport';
import SalesmanTargetReport from '@/pages/reports/SalesmanTargetReport';
import RouteBalanceReport from '@/pages/reports/RouteBalanceReport';

type ReportTab = 'daily-summary' | 'customer-summary' | 'sales' | 'profit' | 'category-profit' | 'expense' | 'receivable-payable' | 'stock' | 'full-pl' | 'salesman-target' | 'route-balance';

const TABS: { id: ReportTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'daily-summary', label: 'Daily Sales Summary', icon: CalendarDays },
  { id: 'customer-summary', label: 'Customer-wise Summary', icon: Users },
  { id: 'full-pl', label: 'Full P&L Report', icon: FileBarChart },
  { id: 'sales', label: 'Sales Report', icon: BarChart3 },
  { id: 'profit', label: 'Profit Report', icon: TrendingUp },
  { id: 'category-profit', label: 'Category-wise Profit', icon: Layers },
  { id: 'expense', label: 'Expense Summary', icon: PieChart },
  { id: 'receivable-payable', label: 'Receivable / Payable', icon: Scale },
  { id: 'salesman-target', label: 'Salesman Target vs Achievement', icon: Target },
  { id: 'route-balance', label: 'Route-wise Shopkeeper Balance', icon: Wallet },
  { id: 'stock', label: 'Stock Report', icon: Package },
];

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('daily-summary');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 hover:border-blue-300'
              }`}
            >
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                active ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
              }`}>
                <Icon size={20} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'daily-summary' && <DailySalesSummary />}
      {tab === 'customer-summary' && <CustomerSummaryReport />}
      {tab === 'sales' && <SalesReport />}
      {tab === 'profit' && <ProfitReport />}
      {tab === 'category-profit' && <CategoryProfitReport />}
      {tab === 'expense' && <ExpenseReport />}
      {tab === 'receivable-payable' && <ReceivablePayableReport />}
      {tab === 'full-pl' && <FullProfitLossReport />}
      {tab === 'salesman-target' && <SalesmanTargetReport />}
      {tab === 'route-balance' && <RouteBalanceReport />}
      {tab === 'stock' && <StockReports />}
    </div>
  );
}
