import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Printer, Calendar, FileStack } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { Customer, GatePass, CustomerInvoice } from '@/lib/types';
import Modal from '@/components/Modal';
import PrintDocument from '@/components/PrintDocument';
import { PrintModal, PrintFormatSelector, normalizeFormat } from '@/components/PrintModal';
import type { PrintFormat } from '@/components/PrintModal';

export default function GatePasses() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GatePass | null>(null);
  const [printPass, setPrintPass] = useState<GatePass | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [dailyDate, setDailyDate] = useState(todayISO());
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    pass_no: '', pass_type: 'sales', customer_id: '', customer_name: '',
    pass_date: todayISO(), reference_invoice: '', items_description: '',
    total_amount: '0', vehicle_no: '', driver_name: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('gate_passes').select('*').order('created_at', { ascending: false });
    setPasses((data ?? []) as GatePass[]);
    const { data: custs } = await supabase.from('customers').select('*').order('name');
    setCustomers((custs ?? []) as Customer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateNo = () => {
    const prefix = settings?.gate_pass_prefix ?? 'GP-';
    return `${prefix}${String(passes.length + 1).padStart(4, '0')}`;
  };

  const filtered = passes.filter((p) =>
    p.pass_no.toLowerCase().includes(search.toLowerCase()) ||
    p.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    p.pass_type.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ pass_no: generateNo(), pass_type: 'sales', customer_id: '', customer_name: '', pass_date: todayISO(), reference_invoice: '', items_description: '', total_amount: '0', vehicle_no: '', driver_name: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (p: GatePass) => {
    setEditing(p);
    setForm({
      pass_no: p.pass_no, pass_type: p.pass_type, customer_id: p.customer_id ?? '',
      customer_name: p.customer_name, pass_date: formatDateInput(p.pass_date),
      reference_invoice: p.reference_invoice ?? '', items_description: p.items_description ?? '',
      total_amount: String(p.total_amount), vehicle_no: p.vehicle_no ?? '',
      driver_name: p.driver_name ?? '', notes: p.notes ?? '',
    });
    setModalOpen(true);
  };

  const onCustomerSelect = (id: string) => {
    const cust = customers.find((c) => c.id === id);
    setForm((prev) => ({ ...prev, customer_id: id, customer_name: cust?.name ?? prev.customer_name }));
  };

  const save = async () => {
    const payload = {
      pass_no: form.pass_no, pass_type: form.pass_type,
      customer_id: form.customer_id || null, customer_name: form.customer_name,
      pass_date: form.pass_date, reference_invoice: form.reference_invoice || null,
      items_description: form.items_description || null,
      total_amount: parseFloat(form.total_amount) || 0,
      vehicle_no: form.vehicle_no || null, driver_name: form.driver_name || null,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from('gate_passes').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('gate_passes').insert(payload);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this gate pass?')) return;
    await supabase.from('gate_passes').delete().eq('id', id);
    load();
  };

  const DAILY_MARKER = 'daily-consolidated';

  const generateDailyPass = async () => {
    setGenerating(true);
    const { data: invs } = await supabase
      .from('customer_invoices')
      .select('id, invoice_no, total, customers(name)')
      .eq('invoice_date', dailyDate)
      .order('invoice_no');
    const invoices = (invs ?? []) as unknown as (CustomerInvoice & { customers?: { name: string } | null })[];
    if (invoices.length === 0) {
      alert(`No bills found for ${formatDate(dailyDate)}.`);
      setGenerating(false);
      return;
    }
    const { data: itemRows } = await supabase
      .from('customer_invoice_items')
      .select('product_name, quantity, unit_price, total, invoice_id')
      .in('invoice_id', invoices.map((i) => i.id));
    const items = (itemRows ?? []) as { product_name: string; quantity: number; unit_price: number; total: number; invoice_id: string }[];
    const { data: existing } = await supabase
      .from('gate_passes')
      .select('id')
      .eq('pass_date', dailyDate)
      .eq('notes', DAILY_MARKER)
      .maybeSingle();
    if (existing) {
      if (!confirm(`A daily gate pass for ${formatDate(dailyDate)} already exists. Create another one anyway?`)) {
        setGenerating(false);
        return;
      }
    }
    const total = invoices.reduce((s, i) => s + i.total, 0);

    // Item-wise summary only: product -> quantity + value
    const itemAgg = new Map<string, { qty: number; value: number }>();
    for (const it of items) {
      const agg = itemAgg.get(it.product_name) ?? { qty: 0, value: 0 };
      agg.qty += it.quantity;
      agg.value += it.total;
      itemAgg.set(it.product_name, agg);
    }
    const itemLines = [...itemAgg.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, agg]) => `${name} × ${agg.qty} = ${agg.value.toFixed(2)}`);
    const description = [
      'ITEM SUMMARY:',
      ...itemLines,
      '',
      'TOTAL ITEMS VALUE: ' + items.reduce((s, it) => s + it.total, 0).toFixed(2),
    ].join('\n');
    const { data: allPasses } = await supabase.from('gate_passes').select('pass_no');
    const usedNos = new Set((allPasses ?? []).map((p) => p.pass_no));
    let passNo = '';
    for (let n = (allPasses?.length ?? 0) + 1; n < (allPasses?.length ?? 0) + 100; n++) {
      const candidate = `${settings?.gate_pass_prefix ?? 'GP-'}${String(n).padStart(4, '0')}`;
      if (!usedNos.has(candidate)) { passNo = candidate; break; }
    }
    const { error } = await supabase.from('gate_passes').insert({
      pass_no: passNo || `${settings?.gate_pass_prefix ?? 'GP-'}${Date.now()}`,
      pass_type: 'sales',
      customer_id: null,
      customer_name: `Daily Bills — ${invoices.length} invoices`,
      pass_date: dailyDate,
      reference_invoice: invoices.map((i) => i.invoice_no).join(', '),
      items_description: description,
      total_amount: total,
      notes: DAILY_MARKER,
    });
    setGenerating(false);
    if (error) {
      alert('Could not create gate pass: ' + error.message);
      return;
    }
    load();
  };

  const openPrint = (p: GatePass) => {
    setPrintPass(p);
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gate passes..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Calendar size={16} className="text-slate-400" />
            <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className="text-sm outline-none bg-transparent" />
          </div>
          <button onClick={generateDailyPass} disabled={generating} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
            <FileStack size={18} /> {generating ? 'Creating...' : 'Daily Gate Pass' }
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
            <Plus size={18} /> New Gate Pass
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No gate passes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Pass No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Vehicle</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.pass_no}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${p.pass_type === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{p.pass_type}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(p.pass_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.vehicle_no ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(p.total_amount, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openPrint(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Print"><Printer size={16} /></button>
                        <button onClick={() => openEdit(p)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => remove(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.pass_no}` : 'New Gate Pass'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Pass No *</label><input value={form.pass_no} onChange={(e) => setForm({ ...form, pass_no: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label><input type="date" value={form.pass_date} onChange={(e) => setForm({ ...form, pass_date: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Pass Type *</label>
              <select value={form.pass_type} onChange={(e) => setForm({ ...form, pass_type: e.target.value })} className="input">
                <option value="sales">Sales (Goods Out)</option>
                <option value="bill">Bill Cut (Invoice Issued)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer</label>
              <select value={form.customer_id} onChange={(e) => onCustomerSelect(e.target.value)} className="input">
                <option value="">Select customer (or type below)...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer Name *</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input" placeholder="Customer name (for pass)" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Reference Invoice</label><input value={form.reference_invoice} onChange={(e) => setForm({ ...form, reference_invoice: e.target.value })} className="input" placeholder="Invoice no" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Total Amount</label><input type="number" step="0.01" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} className="input" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Items / Description</label><textarea value={form.items_description} onChange={(e) => setForm({ ...form, items_description: e.target.value })} className="input" rows={3} placeholder="List of goods being dispatched" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Vehicle No</label><input value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })} className="input" placeholder="Vehicle registration" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Driver Name</label><input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="input" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" /></div>
          <div className="flex gap-3 pt-2"><button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>

      {printOpen && printPass && settings && (
        <PrintModal open onClose={() => setPrintOpen(false)}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          <PrintDocument type="gate-pass" format={printFormat} data={{ settings, gatePass: printPass }} />
        </PrintModal>
      )}
    </div>
  );
}
