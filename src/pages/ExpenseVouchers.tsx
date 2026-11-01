import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { ExpenseVoucher } from '@/lib/types';
import Modal from '@/components/Modal';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Maintenance', 'Office Supplies', 'Marketing', 'Miscellaneous'];

export default function ExpenseVouchers() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [vouchers, setVouchers] = useState<ExpenseVoucher[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseVoucher | null>(null);
  const [form, setForm] = useState({ voucher_no: '', expense_date: todayISO(), category: 'Rent', description: '', amount: '0', paid_to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('expense_vouchers').select('*').order('created_at', { ascending: false });
    setVouchers((data ?? []) as ExpenseVoucher[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateNo = () => {
    const prefix = settings?.expense_voucher_prefix ?? 'EV-';
    return `${prefix}${String(vouchers.length + 1).padStart(4, '0')}`;
  };

  const filtered = vouchers.filter((v) =>
    v.voucher_no.toLowerCase().includes(search.toLowerCase()) ||
    v.category.toLowerCase().includes(search.toLowerCase()) ||
    (v.paid_to ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ voucher_no: generateNo(), expense_date: todayISO(), category: 'Rent', description: '', amount: '0', paid_to: '' });
    setModalOpen(true);
  };

  const openEdit = (v: ExpenseVoucher) => {
    setEditing(v);
    setForm({ voucher_no: v.voucher_no, expense_date: formatDateInput(v.expense_date), category: v.category, description: v.description ?? '', amount: String(v.amount), paid_to: v.paid_to ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      voucher_no: form.voucher_no, expense_date: form.expense_date,
      category: form.category, description: form.description || null,
      amount: parseFloat(form.amount) || 0, paid_to: form.paid_to || null,
    };
    if (editing) {
      await supabase.from('expense_vouchers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('expense_vouchers').insert(payload);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this expense voucher?')) return;
    await supabase.from('expense_vouchers').delete().eq('id', id);
    load();
  };

  const totalToday = vouchers.filter((v) => v.expense_date === todayISO()).reduce((s, v) => s + v.amount, 0);
  const totalMonth = vouchers.filter((v) => v.expense_date.startsWith(todayISO().slice(0, 7))).reduce((s, v) => s + v.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" />
          </div>
          <div className="px-4 py-2.5 bg-rose-50 rounded-lg flex items-center gap-2">
            <span className="text-sm text-rose-700">Today:</span>
            <span className="font-bold text-rose-700">{formatCurrency(totalToday, sym)}</span>
          </div>
          <div className="px-4 py-2.5 bg-amber-50 rounded-lg flex items-center gap-2">
            <span className="text-sm text-amber-700">This Month:</span>
            <span className="font-bold text-amber-700">{formatCurrency(totalMonth, sym)}</span>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
          <Plus size={18} /> New Expense Voucher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No expense vouchers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Voucher No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paid To</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{v.voucher_no}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(v.expense_date)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700">{v.category}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.description ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{v.paid_to ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(v.amount, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(v)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => remove(v.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.voucher_no}` : 'New Expense Voucher'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Voucher No *</label><input value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Category *</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Expense description" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Amount *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Paid To</label><input value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} className="input" placeholder="Recipient name" /></div>
          </div>
          <div className="flex gap-3 pt-2"><button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>
    </div>
  );
}
