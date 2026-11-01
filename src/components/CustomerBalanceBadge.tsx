import type { Customer } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function CustomerBalanceBadge({ customer, symbol }: { customer: Customer | undefined | null; symbol: string }) {
  if (!customer) return null;
  const bal = customer.current_balance ?? 0;
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs">
      <span className="text-slate-500">Previous Balance:</span>
      <span className={`font-bold ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(bal, symbol)}</span>
    </div>
  );
}
