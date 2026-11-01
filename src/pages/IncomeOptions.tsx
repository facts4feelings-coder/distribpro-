import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Calendar } from 'lucide-react';
import { api, incomeDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { IncomeOption } from '@/lib/types';
import Modal from '@/components/Modal';

const CATEGORIES = ['Commission', 'Rent Income', 'Interest', 'Discount Received', 'Scrap Sale', 'Other'];

export default function IncomeOptions() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [incomes, setIncomes] = useState<IncomeOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeOption | null>(null);
  const [form, setForm] = useState({ description: '', amount: '0', income_date: todayISO(), category: 'Other', reference: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.income.list().catch(() => []);
    setIncomes(data.map(incomeDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = incomes.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ description: '', amount: '0', income_date: todayISO(), category: 'Other', reference: '' });
    setModalOpen(true);
  };

  const openEdit = (inc: IncomeOption) => {
    setEditing(inc);
    setForm({ description: inc.description, amount: String(inc.amount), income_date: formatDateInput(inc.income_date), category: inc.category, reference: inc.reference ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      income_date: form.income_date,
      category: form.category,
      reference: form.reference || null,
    };
    const input = {
      description: payload.description, amount: payload.amount,
      incomeDate: payload.income_date, category: payload.category, reference: payload.reference,
    };
    if (editing) {
      await api.income.update(editing.id, input);
    } else {
      await api.income.create(input);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this income entry?')) return;
    await api.income.delete(id);
    load();
  };

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const totalThisMonth = incomes.filter((i) => i.income_date.startsWith(todayISO().slice(0, 7))).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search income..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" />
          </div>
          <div className="px-4 py-2.5 bg-emerald-50 rounded-lg flex items-center gap-2">
            <span className="text-sm text-emerald-700">Total Income:</span>
            <span className="font-bold text-emerald-700">{formatCurrency(totalIncome, sym)}</span>
          </div>
          <div className="px-4 py-2.5 bg-emerald-50 rounded-lg flex items-center gap-2">
            <span className="text-sm text-emerald-700">This Month:</span>
            <span className="font-bold text-emerald-700">{formatCurrency(totalThisMonth, sym)}</span>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
          <Plus size={18} /> Add Income
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No income entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Reference</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{inc.description}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{inc.category}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inc.income_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inc.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(inc.amount, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(inc)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => remove(inc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-bold text-slate-700 text-right">Total:</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(filtered.reduce((s, i) => s + i.amount, 0), sym)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Income' : 'Add Other Income'}>
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Description *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="e.g. Commission from ABC Distributor" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label><input type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Amount *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Reference</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input" placeholder="Receipt no." /></div>
          </div>
          <div className="flex gap-3 pt-2"><button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>
    </div>
  );
}
