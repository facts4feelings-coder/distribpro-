import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Printer, Eye, Calendar, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { Customer, Product, CustomerInvoice, CustomerInvoiceItem, InvoiceWithCustomer } from '@/lib/types';
import Modal from '@/components/Modal';
import PrintDocument from '@/components/PrintDocument';
import { PrintModal, PrintFormatSelector, normalizeFormat } from '@/components/PrintModal';
import type { PrintFormat } from '@/components/PrintModal';
import InvoiceLineItems from '@/components/InvoiceLineItems';
import { recalcCustomerBalance } from '@/lib/customerBalance';

interface PrintEntry {
  invoice: CustomerInvoice;
  items: CustomerInvoiceItem[];
  customer: Customer | null;
}

export default function SalesReturns() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<CustomerInvoice | null>(null);
  const [viewItems, setViewItems] = useState<CustomerInvoiceItem[]>([]);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [printEntries, setPrintEntries] = useState<PrintEntry[]>([]);
  const [editing, setEditing] = useState<CustomerInvoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    invoice_no: '', customer_id: '', invoice_date: todayISO(),
    discount: '0', tax: '0', paid_amount: '0', notes: '',
  });
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string; unit_price: string; discount_percent: string; total: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customer_invoices')
      .select('*, customers(*)')
      .eq('invoice_type', 'sales-return')
      .order('created_at', { ascending: false });
    setInvoices((data ?? []) as InvoiceWithCustomer[]);
    const [c, p] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setCustomers((c.data ?? []) as Customer[]);
    setProducts((p.data ?? []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateReturnNo = () => {
    const prefix = settings?.sales_return_prefix ?? 'SR-';
    return `${prefix}${String(invoices.length + 1).padStart(4, '0')}`;
  };

  const filtered = invoices.filter((inv) =>
    inv.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ invoice_no: generateReturnNo(), customer_id: '', invoice_date: todayISO(), discount: '0', tax: '0', paid_amount: '0', notes: '' });
    setItems([{ product_id: '', product_name: '', quantity: '1', unit_price: '0', discount_percent: '0', total: '0' }]);
    setModalOpen(true);
  };

  const openEdit = async (inv: CustomerInvoice) => {
    setEditing(inv);
    const { data: invItems } = await supabase.from('customer_invoice_items').select('*').eq('invoice_id', inv.id);
    setForm({
      invoice_no: inv.invoice_no, customer_id: inv.customer_id,
      invoice_date: formatDateInput(inv.invoice_date),
      discount: String(inv.discount), tax: String(inv.tax),
      paid_amount: String(inv.paid_amount), notes: inv.notes ?? '',
    });
    setItems((invItems ?? []).map((i: CustomerInvoiceItem) => ({
      product_id: i.product_id ?? '', product_name: i.product_name,
      quantity: String(i.quantity), unit_price: String(i.unit_price),
      discount_percent: String(i.discount_percent ?? 0), total: String(i.total),
    })));
    setModalOpen(true);
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      (next[idx] as Record<string, string>)[field] = value;
      const qty = parseFloat(next[idx].quantity) || 0;
      const price = parseFloat(next[idx].unit_price) || 0;
      next[idx].total = String((qty * price).toFixed(2));
      return next;
    });
  };

  const onProductSelect = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setItems((prev) => {
        const next = [...prev];
        next[idx].product_id = productId;
        next[idx].product_name = product.name;
        next[idx].unit_price = String(product.sale_price);
        const qty = parseFloat(next[idx].quantity) || 1;
        next[idx].total = String((qty * product.sale_price).toFixed(2));
        return next;
      });
    }
  };

  const addItem = () => setItems([...items, { product_id: '', product_name: '', quantity: '1', unit_price: '0', discount_percent: '0', total: '0' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const computeTotals = () => {
    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const discount = parseFloat(form.discount) || 0;
    const tax = parseFloat(form.tax) || 0;
    const total = subtotal - discount + tax;
    const paid = parseFloat(form.paid_amount) || 0;
    const balance = total - paid;
    return { subtotal, discount, tax, total, paid, balance };
  };

  const totals = computeTotals();

  const save = async () => {
    const affectedCustomerIds = new Set<string>();
    if (form.customer_id) affectedCustomerIds.add(form.customer_id);
    if (editing && editing.customer_id) affectedCustomerIds.add(editing.customer_id);
    const payload = {
      invoice_no: form.invoice_no, customer_id: form.customer_id,
      invoice_date: form.invoice_date, due_date: null,
      subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax,
      total: totals.total, paid_amount: totals.paid, balance: totals.balance,
      status: totals.balance <= 0 ? 'paid' : 'unpaid', notes: form.notes || null,
      invoice_type: 'sales-return',
    };

    if (editing) {
      await supabase.from('customer_invoices').update(payload).eq('id', editing.id);
      await supabase.from('customer_invoice_items').delete().eq('invoice_id', editing.id);
      const itemsPayload = items.filter((i) => i.product_name).map((i) => ({
        invoice_id: editing.id, product_id: i.product_id || null, product_name: i.product_name,
        quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0,
        discount_percent: parseFloat(i.discount_percent) || 0, total: parseFloat(i.total) || 0,
      }));
      if (itemsPayload.length > 0) await supabase.from('customer_invoice_items').insert(itemsPayload);
    } else {
      const { data: newInv } = await supabase.from('customer_invoices').insert(payload).select().single();
      if (newInv) {
        const itemsPayload = items.filter((i) => i.product_name).map((i) => ({
          invoice_id: (newInv as CustomerInvoice).id, product_id: i.product_id || null, product_name: i.product_name,
          quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0,
          discount_percent: parseFloat(i.discount_percent) || 0, total: parseFloat(i.total) || 0,
        }));
        if (itemsPayload.length > 0) await supabase.from('customer_invoice_items').insert(itemsPayload);
      }
    }
    for (const cid of affectedCustomerIds) await recalcCustomerBalance(cid);
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this sales return? This cannot be undone.')) return;
    const inv = invoices.find((i) => i.id === id);
    await supabase.from('customer_invoice_items').delete().eq('invoice_id', id);
    await supabase.from('customer_invoices').delete().eq('id', id);
    if (inv?.customer_id) await recalcCustomerBalance(inv.customer_id);
    load();
  };

  const openPrint = async (inv: CustomerInvoice) => {
    const { data: invItems } = await supabase.from('customer_invoice_items').select('*').eq('invoice_id', inv.id);
    const cust = customers.find((c) => c.id === inv.customer_id) ?? null;
    setPrintEntries([{ invoice: inv, items: (invItems ?? []) as CustomerInvoiceItem[], customer: cust }]);
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  const openView = async (inv: CustomerInvoice) => {
    const { data: invItems } = await supabase.from('customer_invoice_items').select('*').eq('invoice_id', inv.id);
    const cust = customers.find((c) => c.id === inv.customer_id) ?? null;
    setViewInvoice(inv);
    setViewItems((invItems ?? []) as CustomerInvoiceItem[]);
    setViewCustomer(cust);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((i) => i.id)));
  };

  const openBulkPrint = async () => {
    if (selectedIds.size === 0) return;
    const entries: PrintEntry[] = [];
    for (const id of selectedIds) {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) continue;
      const { data: invItems } = await supabase.from('customer_invoice_items').select('*').eq('invoice_id', id);
      const cust = customers.find((c) => c.id === inv.customer_id) ?? null;
      entries.push({ invoice: inv, items: (invItems ?? []) as CustomerInvoiceItem[], customer: cust });
    }
    setPrintEntries(entries);
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search returns..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" />
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button onClick={openBulkPrint} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
              <Printer size={18} /> Print {selectedIds.size}
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-rose-600/20">
            <Plus size={18} /> New Sales Return
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No sales returns found. Click "New Sales Return" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-600 transition-colors">
                      {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Return No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(inv.id) ? 'bg-rose-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(inv.id)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        {selectedIds.has(inv.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{inv.invoice_no}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(inv.total, sym)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openView(inv)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="View"><Eye size={16} /></button>
                        <button onClick={() => openPrint(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Print"><Printer size={16} /></button>
                        <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => remove(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Return ${editing.invoice_no}` : 'New Sales Return'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Return No *</label>
              <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer *</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input">
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label>
              <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className="input" />
            </div>
          </div>

          <InvoiceLineItems items={items} products={products} sym={sym} onUpdateItem={updateItem} onProductSelect={onProductSelect} onAddItem={addItem} onRemoveItem={removeItem} />

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span className="font-medium">{formatCurrency(totals.subtotal, sym)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-600">Discount:</span><input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" /></div>
              <div className="flex justify-between items-center"><span className="text-slate-600">Tax:</span><input type="number" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" /></div>
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2"><span>Total:</span><span>{formatCurrency(totals.total, sym)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-600">Refund Amount:</span><input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" /></div>
              <div className="flex justify-between font-bold text-rose-600"><span>Balance:</span><span>{formatCurrency(totals.balance, sym)}</span></div>
            </div>
          </div>

          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} placeholder="Reason for return..." /></div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg font-medium transition-all">Save Return</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {viewInvoice && !printOpen && (
        <Modal open onClose={() => setViewInvoice(null)} title={`Sales Return ${viewInvoice.invoice_no}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs uppercase">Customer</p><p className="font-bold text-slate-800">{viewCustomer?.name ?? '—'}</p></div>
              <div className="text-right"><p className="text-slate-500 text-xs uppercase">Date</p><p className="font-bold text-slate-800">{formatDate(viewInvoice.invoice_date)}</p></div>
            </div>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50"><tr><th className="text-left p-2">Product</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Price</th><th className="text-right p-2">Total</th></tr></thead>
              <tbody>{viewItems.map((item) => (<tr key={item.id} className="border-t border-slate-100"><td className="p-2">{item.product_name}</td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right">{formatCurrency(item.unit_price, sym)}</td><td className="p-2 text-right font-medium">{formatCurrency(item.total, sym)}</td></tr>))}</tbody>
            </table>
            <div className="flex justify-end"><div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span>{formatCurrency(viewInvoice.subtotal, sym)}</span></div>
              {viewInvoice.discount > 0 && <div className="flex justify-between"><span className="text-slate-600">Discount:</span><span>-{formatCurrency(viewInvoice.discount, sym)}</span></div>}
              {viewInvoice.tax > 0 && <div className="flex justify-between"><span className="text-slate-600">Tax:</span><span>{formatCurrency(viewInvoice.tax, sym)}</span></div>}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>Total:</span><span>{formatCurrency(viewInvoice.total, sym)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Refunded:</span><span>{formatCurrency(viewInvoice.paid_amount, sym)}</span></div>
              <div className="flex justify-between font-bold text-rose-600"><span>Balance:</span><span>{formatCurrency(viewInvoice.balance, sym)}</span></div>
            </div></div>
            <div className="flex gap-3">
              <button onClick={() => { setPrintEntries([{ invoice: viewInvoice, items: viewItems, customer: viewCustomer }]); setPrintFormat(normalizeFormat(settings?.default_print_format)); setPrintOpen(true); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
                <Printer size={18} /> Print Return
              </button>
              <button onClick={() => setViewInvoice(null)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg text-sm font-medium transition-all">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Print Modal */}
      {printOpen && settings && (
        <PrintModal open onClose={() => setPrintOpen(false)} bulkCount={printEntries.length}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          {printEntries.map((entry, idx) => (
            <div key={entry.invoice.id} className={idx > 0 ? 'mt-6 pt-6 border-t-2 border-dashed border-slate-300' : ''}>
              <PrintDocument type="sales-return" format={printFormat} data={{ settings, invoice: entry.invoice, customer: entry.customer ?? undefined, items: entry.items }} isLast={idx === printEntries.length - 1} />
            </div>
          ))}
        </PrintModal>
      )}
    </div>
  );
}
