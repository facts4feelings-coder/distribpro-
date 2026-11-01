import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import ActivationScreen from '@/pages/ActivationScreen';
import LicenseExpiredScreen from '@/pages/LicenseExpiredScreen';
import { checkLicense, clearActivation, type LicenseState } from '@/lib/license';
import Layout, { type PageId } from '@/components/Layout';
import { usePermissions, hasPermission } from '@/hooks/usePermissions';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Suppliers from '@/pages/Suppliers';
import Products from '@/pages/Products';
import Routes from '@/pages/Routes';
import QuickSale from '@/pages/QuickSale';import Returns from '@/pages/Returns';
import Invoices from '@/pages/Invoices';
import PaymentVouchers from '@/pages/PaymentVouchers';
import ExpenseVouchers from '@/pages/ExpenseVouchers';
import IncomeOptions from '@/pages/IncomeOptions';
import GatePasses from '@/pages/GatePasses';
import Reports from '@/pages/Reports';
import PrintRecords from '@/pages/PrintRecords';
import Salaries from '@/pages/Salaries';
import SettingsPage from '@/pages/SettingsPage';

function AppContent() {
  const { session, loading } = useAuth();
  const [licenseState, setLicenseState] = useState<LicenseState>(() => checkLicense());
  const [page, setPage] = useState<PageId>('dashboard');
  const { permissions, loading: permsLoading } = usePermissions(session?.id);

  // Re-check license periodically so expiry kicks in without a reload.
  useEffect(() => {
    const t = setInterval(() => setLicenseState(checkLicense()), 60000);
    return () => clearInterval(t);
  }, []);

  const refreshLicense = () => {
    setLicenseState(checkLicense());
  };

  if (licenseState.status === 'missing' || licenseState.status === 'invalid') {
    return <ActivationScreen onActivated={refreshLicense} />;
  }
  if (licenseState.status === 'expired') {
    return <LicenseExpiredScreen state={licenseState} onReActivate={() => { clearActivation(); setLicenseState(checkLicense()); }} />;
  }

  if (loading || (session && permsLoading)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setPage} />,
    customers: <Customers />,
    suppliers: <Suppliers />,
    products: <Products />,
    routes: <Routes />,
    'quick-sale': <QuickSale />,
    returns: <Returns />,
    invoices: <Invoices />,
    'payment-vouchers': <PaymentVouchers />,
    'expense-vouchers': <ExpenseVouchers />,
    'income-options': <IncomeOptions />,
    'gate-passes': <GatePasses />,
    reports: <Reports />,
    'print-records': <PrintRecords />,
    salaries: <Salaries />,
    settings: <SettingsPage />,
  };

  const allowed: PageId = hasPermission(permissions, page) ? page : 'dashboard';

  return (
    <Layout current={allowed} onNavigate={setPage}>
      {pages[allowed]}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
