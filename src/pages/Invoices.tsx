import { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import CustomerInvoices from '@/pages/CustomerInvoices';
import SupplierInvoices from '@/pages/SupplierInvoices';

type InvoiceTab = 'sales' | 'purchase';

export default function Invoices() {
  const [tab, setTab] = useState<InvoiceTab>('sales');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'sales' as const, label: 'Customer Invoices', icon: FileText },
          { id: 'purchase' as const, label: 'Supplier Invoices', icon: Receipt },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'sales' && <CustomerInvoices />}
      {tab === 'purchase' && <SupplierInvoices />}
    </div>
  );
}
