import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, BookOpen, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api, supplierDtoToLegacy, partyInputFromLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, escapeHtml } from '@/lib/utils';
import { printHtml } from '@/lib/reportPrint';
import type { Supplier, SupplierInvoice } from '@/lib/types';
import Modal from '@/components/Modal';

export default function Suppliers() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', opening_balance: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.suppliers.list().catch(() => []);
    setSuppliers(data.map(supplierDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? '').includes(search) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', city: '', opening_balance: '0' });
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? '',
      address: s.address ?? '',
      city: s.city ?? '',
      opening_balance: String(s.opening_balance),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
      current_balance: parseFloat(form.opening_balance) || 0,
    };
    const input = partyInputFromLegacy(payload);
    if (editing) {
      await api.suppliers.update(editing.id, input);
    } else {
      await api.suppliers.create(input);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this supplier? This cannot be undone.')) return;
    const { error } = await api.suppliers.delete(id);
    if (error) { alert(error); return; }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
          />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No suppliers found. Click "Add Supplier" to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">City</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{s.city ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(s.current_balance, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setLedgerSupplier(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Ledger">
                          <BookOpen size={16} />
                        </button>
                        <button onClick={() => openEdit(s)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Supplier name" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="Phone number" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" placeholder="Street address" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">City</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" placeholder="City" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Opening Balance (Payable)</label>
            <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>

      {ledgerSupplier && <SupplierLedgerModal supplier={ledgerSupplier} onClose={() => setLedgerSupplier(null)} sym={sym} />}
    </div>
  );
}

function SupplierLedgerModal({ supplier, onClose, sym }: { supplier: Supplier; onClose: () => void; sym: string }) {
  const [entries, setEntries] = useState<{ date: string; description: string; debit: number; credit: number; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // TODO(Phase 4): ledger reads supplier invoices — migrates with the
      // transaction services; still on the local shim until then.
      const { data: invoices } = await supabase.from('supplier_invoices').select('*').eq('supplier_id', supplier.id).order('invoice_date');

      type RawEntry = { date: string; description: string; debit: number; credit: number };
      const raw: RawEntry[] = [];

      raw.push({ date: supplier.created_at, description: 'Opening Balance', debit: 0, credit: supplier.opening_balance });

      ((invoices ?? []) as SupplierInvoice[]).forEach((inv) => {
        raw.push({ date: inv.invoice_date, description: `Invoice ${inv.invoice_no}`, debit: inv.paid_amount, credit: inv.total });
      });

      raw.sort((a, b) => a.date.localeCompare(b.date));

      let bal = 0;
      const withBalance = raw.map((e) => {
        bal += e.credit - e.debit;
        return { ...e, balance: bal };
      });

      setEntries(withBalance);
      setLoading(false);
    })();
  }, [supplier]);

  const printLedger = () => {
    const tableHtml = document.getElementById('supplier-ledger-table')?.outerHTML ?? '';
    printHtml(
      `Ledger — ${escapeHtml(supplier.name)}`,
      `<h1>${escapeHtml(supplier.name)} — Ledger</h1>
      <div class="summary"><p><strong>Current Payable Balance:</strong> ${formatCurrency(supplier.current_balance, sym)}</p></div>
      ${tableHtml}`
    );
  };

  return (
    <Modal open onClose={onClose} title={`Ledger — ${supplier.name}`} size="xl">
      <div className="mb-4 p-4 bg-slate-50 rounded-lg flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Current Payable Balance</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(supplier.current_balance, sym)}</p>
        </div>
        <button onClick={printLedger} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
          <Printer size={16} /> Print
        </button>
      </div>
      {loading ? (
        <p className="text-center text-slate-400 py-8">Loading ledger...</p>
      ) : (
        <div className="overflow-x-auto">
          <table id="supplier-ledger-table" className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Debit (Paid)</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Credit (Bill)</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{formatDate(e.date)}</td>
                  <td className="px-3 py-2 text-slate-800">{e.description}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{e.debit > 0 ? formatCurrency(e.debit, sym) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{e.credit > 0 ? formatCurrency(e.credit, sym) : '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(e.balance, sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
