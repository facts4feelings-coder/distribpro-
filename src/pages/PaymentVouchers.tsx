import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Printer, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { Customer, Supplier, PaymentVoucher, PaymentVoucherWithCustomer } from '@/lib/types';
import Modal from '@/components/Modal';
import CustomerBalanceBadge from '@/components/CustomerBalanceBadge';
import { recalcCustomerBalance, recalcSupplierBalance } from '@/lib/customerBalance';
import PrintDocument from '@/components/PrintDocument';
import { PrintModal, PrintFormatSelector, normalizeFormat } from '@/components/PrintModal';
import type { PrintFormat } from '@/components/PrintModal';

export default function PaymentVouchers() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [vouchers, setVouchers] = useState<PaymentVoucherWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentVoucher | null>(null);
  const [printVoucher, setPrintVoucher] = useState<PaymentVoucher | null>(null);
  const [printCustomer, setPrintCustomer] = useState<Customer | null>(null);
  const [printSupplier, setPrintSupplier] = useState<Supplier | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [form, setForm] = useState({ voucher_no: '', payee_type: 'customer' as 'customer' | 'supplier', customer_id: '', supplier_id: '', voucher_date: todayISO(), amount: '0', payment_method: 'cash', reference: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('payment_vouchers').select('*, customers(*), suppliers(*)').order('created_at', { ascending: false });
    setVouchers((data ?? []) as PaymentVoucherWithCustomer[]);
    const { data: custs } = await supabase.from('customers').select('*').order('name');
    setCustomers((custs ?? []) as Customer[]);
    const { data: sups } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers((sups ?? []) as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateNo = () => {
    const prefix = settings?.payment_voucher_prefix ?? 'PV-';
    return `${prefix}${String(vouchers.length + 1).padStart(4, '0')}`;
  };

  const filtered = vouchers.filter((v) =>
    v.voucher_no.toLowerCase().includes(search.toLowerCase()) ||
    (v.customers?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (v.suppliers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ voucher_no: generateNo(), payee_type: 'customer', customer_id: '', supplier_id: '', voucher_date: todayISO(), amount: '0', payment_method: 'cash', reference: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (v: PaymentVoucher) => {
    setEditing(v);
    const payeeType = v.supplier_id ? 'supplier' : 'customer';
    setForm({ voucher_no: v.voucher_no, payee_type: payeeType, customer_id: v.customer_id ?? '', supplier_id: v.supplier_id ?? '', voucher_date: formatDateInput(v.voucher_date), amount: String(v.amount), payment_method: v.payment_method, reference: v.reference ?? '', notes: v.notes ?? '' });
    setModalOpen(true);
  };

  const applyPaymentToInvoices = async (customerId: string, amount: number) => {
    const { data: invoices } = await supabase
      .from('customer_invoices')
      .select('id, paid_amount, balance, total, status')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'sale')
      .gt('balance', 0)
      .order('invoice_date', { ascending: true });

    let remaining = amount;
    for (const inv of (invoices ?? []) as { id: string; paid_amount: number; balance: number; total: number; status: string }[]) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, inv.balance);
      const newPaid = inv.paid_amount + applied;
      const newBalance = inv.balance - applied;
      await supabase.from('customer_invoices')
        .update({ paid_amount: newPaid, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .eq('id', inv.id);
      remaining -= applied;
    }
  };

  const reversePaymentFromInvoices = async (customerId: string, amount: number) => {
    const { data: invoices } = await supabase
      .from('customer_invoices')
      .select('id, paid_amount, balance, total, status')
      .eq('customer_id', customerId)
      .eq('invoice_type', 'sale')
      .gt('paid_amount', 0)
      .order('invoice_date', { ascending: false });

    let remaining = amount;
    for (const inv of (invoices ?? []) as { id: string; paid_amount: number; balance: number; total: number; status: string }[]) {
      if (remaining <= 0) break;
      const reversed = Math.min(remaining, inv.paid_amount);
      const newPaid = inv.paid_amount - reversed;
      const newBalance = inv.balance + reversed;
      await supabase.from('customer_invoices')
        .update({ paid_amount: newPaid, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .eq('id', inv.id);
      remaining -= reversed;
    }
  };

  const applyPaymentToSupplierInvoices = async (supplierId: string, amount: number) => {
    const { data: invoices } = await supabase
      .from('supplier_invoices')
      .select('id, paid_amount, balance, status')
      .eq('supplier_id', supplierId)
      .eq('invoice_type', 'purchase')
      .gt('balance', 0)
      .order('invoice_date', { ascending: true });

    let remaining = amount;
    for (const inv of (invoices ?? []) as { id: string; paid_amount: number; balance: number; status: string }[]) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, inv.balance);
      const newPaid = inv.paid_amount + applied;
      const newBalance = inv.balance - applied;
      await supabase.from('supplier_invoices')
        .update({ paid_amount: newPaid, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .eq('id', inv.id);
      remaining -= applied;
    }
  };

  const reversePaymentFromSupplierInvoices = async (supplierId: string, amount: number) => {
    const { data: invoices } = await supabase
      .from('supplier_invoices')
      .select('id, paid_amount, balance, status')
      .eq('supplier_id', supplierId)
      .eq('invoice_type', 'purchase')
      .gt('paid_amount', 0)
      .order('invoice_date', { ascending: false });

    let remaining = amount;
    for (const inv of (invoices ?? []) as { id: string; paid_amount: number; balance: number; status: string }[]) {
      if (remaining <= 0) break;
      const reversed = Math.min(remaining, inv.paid_amount);
      const newPaid = inv.paid_amount - reversed;
      const newBalance = inv.balance + reversed;
      await supabase.from('supplier_invoices')
        .update({ paid_amount: newPaid, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .eq('id', inv.id);
      remaining -= reversed;
    }
  };

  const updateCustomerBalance = async (customerId: string) => {
    await recalcCustomerBalance(customerId);
  };

  const updateSupplierBalance = async (supplierId: string) => {
    await recalcSupplierBalance(supplierId);
  };

  const save = async () => {
    const amount = parseFloat(form.amount) || 0;
    const isSupplier = form.payee_type === 'supplier';
    const payload = {
      voucher_no: form.voucher_no,
      customer_id: isSupplier ? null : form.customer_id || null,
      supplier_id: isSupplier ? form.supplier_id || null : null,
      voucher_date: form.voucher_date, amount,
      payment_method: form.payment_method, reference: form.reference || null, notes: form.notes || null,
    };
    if (editing) {
      const wasSupplier = !!editing.supplier_id;
      await supabase.from('payment_vouchers').update(payload).eq('id', editing.id);
      if (wasSupplier && editing.amount > 0 && editing.supplier_id) {
        await reversePaymentFromSupplierInvoices(editing.supplier_id, editing.amount);
        await updateSupplierBalance(editing.supplier_id);
      } else if (!wasSupplier && editing.customer_id && editing.amount > 0) {
        await reversePaymentFromInvoices(editing.customer_id, editing.amount);
        await updateCustomerBalance(editing.customer_id);
      }
      if (isSupplier && form.supplier_id && amount > 0) {
        await applyPaymentToSupplierInvoices(form.supplier_id, amount);
        await updateSupplierBalance(form.supplier_id);
      } else if (!isSupplier && form.customer_id && amount > 0) {
        await applyPaymentToInvoices(form.customer_id, amount);
        await updateCustomerBalance(form.customer_id);
      }
    } else {
      await supabase.from('payment_vouchers').insert(payload);
      if (isSupplier && form.supplier_id && amount > 0) {
        await applyPaymentToSupplierInvoices(form.supplier_id, amount);
        await updateSupplierBalance(form.supplier_id);
      } else if (!isSupplier && form.customer_id && amount > 0) {
        await applyPaymentToInvoices(form.customer_id, amount);
        await updateCustomerBalance(form.customer_id);
      }
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const voucher = vouchers.find((v) => v.id === id);
    if (!voucher) return;
    if (!confirm('Delete this voucher? The payment will be reversed from invoices.')) return;
    await supabase.from('payment_vouchers').delete().eq('id', id);
    if (voucher.supplier_id && voucher.amount > 0) {
      await reversePaymentFromSupplierInvoices(voucher.supplier_id, voucher.amount);
      await updateSupplierBalance(voucher.supplier_id);
    } else if (voucher.customer_id && voucher.amount > 0) {
      await reversePaymentFromInvoices(voucher.customer_id, voucher.amount);
      await updateCustomerBalance(voucher.customer_id);
    }
    load();
  };

  const openPrint = (v: PaymentVoucher) => {
    const cust = customers.find((c) => c.id === v.customer_id) ?? null;
    const sup = suppliers.find((s) => s.id === v.supplier_id) ?? null;
    setPrintVoucher(v);
    setPrintCustomer(cust);
    setPrintSupplier(sup);
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  const totalToday = vouchers.filter((v) => v.voucher_date === todayISO()).reduce((s, v) => s + v.amount, 0);

  const [daySummaryDate, setDaySummaryDate] = useState(todayISO());
  const [daySummaryOpen, setDaySummaryOpen] = useState(false);

  const openDaySummary = () => {
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setDaySummaryOpen(true);
  };

  const daySummaryEntries = vouchers
    .filter((v) => v.voucher_date === daySummaryDate)
    .map((v) => ({ name: v.customers?.name ?? v.suppliers?.name ?? 'Unknown', amount: v.amount }));
  const daySummaryTotal = daySummaryEntries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vouchers..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" />
          </div>
          <div className="px-4 py-2.5 bg-emerald-50 rounded-lg flex items-center gap-2">
            <span className="text-sm text-emerald-700">Today's Payments:</span>
            <span className="font-bold text-emerald-700">{formatCurrency(totalToday, sym)}</span>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
          <Plus size={18} /> New Payment Voucher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <label className="text-sm font-medium text-slate-700">Day Summary</label>
          <input type="date" value={daySummaryDate} onChange={(e) => setDaySummaryDate(e.target.value)} className="input !w-auto py-2" />
          <span className="text-sm text-slate-500">{daySummaryEntries.length} payments · {formatCurrency(daySummaryTotal, sym)}</span>
        </div>
        <button
          onClick={openDaySummary}
          disabled={daySummaryEntries.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20"
        >
          <Printer size={16} /> Print Day Voucher
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No payment vouchers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Voucher No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Paid To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Method</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{v.voucher_no}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {v.customers?.name ?? v.suppliers?.name ?? '—'}
                      {v.supplier_id && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Supplier</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(v.voucher_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 uppercase">{v.payment_method}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(v.amount, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openPrint(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Print"><Printer size={16} /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.voucher_no}` : 'New Payment Voucher'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Voucher No *</label><input value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label><input type="date" value={form.voucher_date} onChange={(e) => setForm({ ...form, voucher_date: e.target.value })} className="input" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Paid To *</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setForm({ ...form, payee_type: 'customer' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.payee_type === 'customer' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Customer</button>
              <button type="button" onClick={() => setForm({ ...form, payee_type: 'supplier' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.payee_type === 'supplier' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Supplier</button>
            </div>
            {form.payee_type === 'customer' ? (
              <>
                <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input"><option value="">Select customer...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <CustomerBalanceBadge customer={customers.find((c) => c.id === form.customer_id)} symbol={sym} />
              </>
            ) : (
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input"><option value="">Select supplier...</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Amount *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Payment Method</label><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input"><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="bank">Bank Transfer</option><option value="other">Other</option></select></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Reference (Cheque/Receipt No)</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} /></div>
          <div className="flex gap-3 pt-2"><button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>

      {printOpen && printVoucher && settings && (
        <PrintModal open onClose={() => setPrintOpen(false)}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          <PrintDocument type="payment-voucher" format={printFormat} data={{ settings, voucher: printVoucher, customer: printCustomer ?? undefined, supplier: printSupplier ?? undefined }} />
        </PrintModal>
      )}

      {daySummaryOpen && settings && (
        <PrintModal open onClose={() => setDaySummaryOpen(false)} bulkCount={1}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          <PrintDocument
            type="day-payment-summary"
            format={printFormat}
            data={{ settings, daySummary: { date: daySummaryDate, entries: daySummaryEntries, total: daySummaryTotal } }}
            isLast
          />
        </PrintModal>
      )}
    </div>
  );
}
