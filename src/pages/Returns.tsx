import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import SalesReturns from '@/pages/SalesReturns';
import PurchaseReturns from '@/pages/PurchaseReturns';

type ReturnTab = 'sales' | 'purchase';

export default function Returns() {
  const [tab, setTab] = useState<ReturnTab>('sales');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'sales' as const, label: 'Sales Return' },
          { id: 'purchase' as const, label: 'Purchase Return' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Undo2 size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && <SalesReturns />}
      {tab === 'purchase' && <PurchaseReturns />}
    </div>
  );
}
