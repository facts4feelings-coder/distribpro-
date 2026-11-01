import { useEffect, useState, useCallback } from 'react';
import { ShoppingCart, CheckCircle, Printer, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, todayISO } from '@/lib/utils';
import type { Customer, Product, CustomerInvoice, CustomerInvoiceItem } from '@/lib/types';
import InvoiceLineItems from '@/components/InvoiceLineItems';
import { QuickAddCustomer, QuickAddProduct } from '@/components/QuickAdd';
import CustomerBalanceBadge from '@/components/CustomerBalanceBadge';
import { recalcCustomerBalance } from '@/lib/customerBalance';
import type { GatePass } from '@/lib/types';
import PrintDocument from '@/components/PrintDocument';
import { PrintModal, PrintFormatSelector, normalizeFormat } from '@/components/PrintModal';
import type { PrintFormat } from '@/components/PrintModal';

export default function QuickSale() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [savedInvoice, setSavedInvoice] = useState<CustomerInvoice | null>(null);
  const [savedItems, setSavedItems] = useState<CustomerInvoiceItem[]>([]);
  const [savedCustomer, setSavedCustomer] = useState<Customer | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('a4');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    invoice_no: '',
    customer_id: '',
    invoice_date: todayISO(),
    discount: '0',
    tax: '0',
    paid_amount: '0',
    payment_type: 'cash' as 'cash' | 'credit',
    notes: '',
  });
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string; unit_price: string; discount_percent: string; total: string }[]>([]);
  const [customerRates, setCustomerRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!form.customer_id) {
      setCustomerRates({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('customer_invoice_items')
        .select('product_id, unit_price, customer_invoices!inner(customer_id)')
        .eq('customer_invoices.customer_id', form.customer_id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      const rates: Record<string, number> = {};
      for (const row of (data ?? []) as { product_id: string | null; unit_price: number }[]) {
        if (row.product_id && !(row.product_id in rates)) rates[row.product_id] = row.unit_price;
      }
      setCustomerRates(rates);
    })();
    return () => { cancelled = true; };
  }, [form.customer_id]);

  const load = useCallback(async () => {
    const [c, p, invRes] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('customer_invoices').select('invoice_no', { count: 'exact' }).eq('invoice_type', 'sale'),
    ]);
    setCustomers((c.data ?? []) as Customer[]);
    setProducts((p.data ?? []) as Product[]);

    const prefix = settings?.invoice_prefix ?? 'INV-';
    const count = (invRes.count ?? 0) + 1;
    setForm((f) => ({ ...f, invoice_no: `${prefix}${String(count).padStart(4, '0')}` }));
  }, [settings?.invoice_prefix]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (idx: number, field: string, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      (next[idx] as Record<string, string>)[field] = value;
      const qty = parseFloat(next[idx].quantity) || 0;
      const price = parseFloat(next[idx].unit_price) || 0;
      const disc = Math.min(Math.max(parseFloat(next[idx].discount_percent) || 0, 0), 100);
      next[idx].total = String((qty * price * (1 - disc / 100)).toFixed(2));
      return next;
    });
  };

  const onProductSelect = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const rate = customerRates[productId] ?? product.sale_price;
      setItems((prev) => {
        const next = [...prev];
        const disc = Math.min(Math.max(parseFloat(next[idx].discount_percent) || 0, 0), 100);
        next[idx].product_id = productId;
        next[idx].product_name = product.name;
        next[idx].unit_price = String(rate);
        const qty = parseFloat(next[idx].quantity) || 1;
        next[idx].total = String((qty * rate * (1 - disc / 100)).toFixed(2));
        return next;
      });
    }
  };

  const addItem = () => setItems([...items, { product_id: '', product_name: '', quantity: '1', unit_price: '0', discount_percent: '0', total: '0' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const onBarcodeScan = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === productId);
      if (existing) {
        return prev.map((i) =>
          i.product_id === productId
            ? (() => {
                const qty = (parseFloat(i.quantity) || 0) + 1;
                return { ...i, quantity: String(qty), total: String((qty * (parseFloat(i.unit_price) || 0)).toFixed(2)) };
              })()
            : i
        );
      }
      return [
        ...prev.filter((i) => i.product_name || parseFloat(i.total) > 0),
        { product_id: productId, product_name: product.name, quantity: '1', unit_price: String(product.sale_price), discount_percent: '0', total: String(product.sale_price) },
      ];
    });
  };

  const computeTotals = () => {
    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
    const discount = parseFloat(form.discount) || 0;
    const tax = parseFloat(form.tax) || 0;
    const total = subtotal - discount + tax;
    let paid: number;
    if (form.payment_type === 'cash') {
      paid = total;
    } else {
      paid = Math.min(parseFloat(form.paid_amount) || 0, total);
    }
    const balance = total - paid;
    return { subtotal, discount, tax, total, paid, balance };
  };

  const totals = computeTotals();

  const resetForm = () => {
    const prefix = settings?.invoice_prefix ?? 'INV-';
    supabase.from('customer_invoices').select('invoice_no', { count: 'exact' }).eq('invoice_type', 'sale').then(({ count }) => {
      const nextCount = (count ?? 0) + 1;
      setForm({ invoice_no: `${prefix}${String(nextCount).padStart(4, '0')}`, customer_id: '', invoice_date: todayISO(), discount: '0', tax: '0', paid_amount: '0', payment_type: 'cash', notes: '' });
      setItems([{ product_id: '', product_name: '', quantity: '1', unit_price: '0', discount_percent: '0', total: '0' }]);
    });
  };

  const createGatePassForSale = async (inv: CustomerInvoice, cust: Customer | null) => {
    const desc = items.filter((i) => i.product_name).map((i) => `${i.product_name} x ${i.quantity}`).join(', ');
    const { data: existing } = await supabase.from('gate_passes').select('id', { count: 'exact', head: true });
    const prefix = settings?.gate_pass_prefix ?? 'GP-';
    const payload: Partial<GatePass> = {
      pass_no: `${prefix}${String((existing?.length ?? 0) + 1).padStart(4, '0')}`,
      pass_type: 'sales',
      customer_id: inv.customer_id,
      customer_name: cust?.name ?? '',
      pass_date: inv.invoice_date,
      reference_invoice: inv.invoice_no,
      items_description: desc || null,
      total_amount: inv.total,
    };
    await supabase.from('gate_passes').insert(payload);
  };

  const save = async () => {
    if (!form.customer_id) { alert('Please select a customer.'); return; }    const hasItems = items.some((i) => i.product_name);
    if (!hasItems) { alert('Please add at least one product.'); return; }

    const validItems = items.filter((i) => i.product_name);
    for (const i of validItems) {
      const product = products.find((p) => p.id === i.product_id) ?? products.find((p) => p.name.toLowerCase() === i.product_name.trim().toLowerCase());
      if (!product) continue;
      const qty = parseFloat(i.quantity) || 0;
      if ((product.stock_quantity ?? 0) <= 0) {
        alert(`"${product.name}" is out of stock and cannot be added to the bill.`);
        return;
      }
      if (qty > product.stock_quantity) {
        alert(`"${product.name}": only ${product.stock_quantity} in stock, but you are selling ${qty}.`);
        return;
      }
      if ((parseFloat(i.unit_price) || 0) < product.purchase_price) {
        const ok = confirm(`Warning: "${product.name}" is being sold below its purchase cost — you will make a loss.\n\nCost: ${product.purchase_price} / Selling: ${i.unit_price}\n\nDo you still want to sell it?`);
        if (!ok) return;
      }
    }

    setSaving(true);
    const payload = {
      invoice_no: form.invoice_no,
      customer_id: form.customer_id,
      invoice_date: form.invoice_date,
      due_date: null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      paid_amount: totals.paid,
      balance: totals.balance,
      status: totals.balance <= 0 ? 'paid' : 'unpaid',
      payment_type: form.payment_type,
      notes: form.notes || null,
      invoice_type: 'sale',
    };

    const { data: newInv } = await supabase.from('customer_invoices').insert(payload).select().single();
    if (newInv) {
      const itemsPayload = items.filter((i) => i.product_name).map((i) => ({
        invoice_id: (newInv as CustomerInvoice).id,
        product_id: i.product_id || null,
        product_name: i.product_name,
        quantity: parseFloat(i.quantity) || 0,
        unit_price: parseFloat(i.unit_price) || 0,
        discount_percent: parseFloat(i.discount_percent) || 0,
        total: parseFloat(i.total) || 0,
      }));
      if (itemsPayload.length > 0) {
        await supabase.from('customer_invoice_items').insert(itemsPayload);
      }
      const inv = newInv as CustomerInvoice;
      const { data: freshItems } = await supabase.from('customer_invoice_items').select('*').eq('invoice_id', inv.id);
      const cust = customers.find((c) => c.id === inv.customer_id) ?? null;
      await createGatePassForSale(inv, cust);
      setSavedInvoice(inv);
      setSavedItems((freshItems ?? []) as CustomerInvoiceItem[]);
      setSavedCustomer(cust);
    }
    if (form.customer_id) await recalcCustomerBalance(form.customer_id);
    setSaving(false);
  };

  const startNewSale = () => {
    setSavedInvoice(null);
    setSavedItems([]);
    setSavedCustomer(null);
    resetForm();
  };

  const openPrint = () => {
    if (!savedInvoice) return;
    setPrintFormat(normalizeFormat(settings?.default_print_format));
    setPrintOpen(true);
  };

  // Success screen after save
  if (savedInvoice && !printOpen) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Sale Completed!</h2>
          <p className="text-sm text-slate-500 mb-6">Invoice {savedInvoice.invoice_no} has been saved successfully.</p>

          <div className="bg-slate-50 rounded-lg p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Customer:</span><span className="font-medium text-slate-800">{savedCustomer?.name ?? '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Date:</span><span className="font-medium text-slate-800">{savedInvoice.invoice_date}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Payment:</span><span className={`font-medium ${savedInvoice.payment_type === 'cash' ? 'text-emerald-600' : 'text-amber-600'}`}>{savedInvoice.payment_type === 'cash' ? 'Cash (Full)' : 'Credit'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Total:</span><span className="font-bold text-slate-800">{formatCurrency(savedInvoice.total, sym)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Paid:</span><span className="font-medium text-emerald-600">{formatCurrency(savedInvoice.paid_amount, sym)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Balance:</span><span className="font-bold text-rose-600">{formatCurrency(savedInvoice.balance, sym)}</span></div>
          </div>

          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-6">
            <thead className="bg-slate-50">
              <tr><th className="text-left p-2">Product</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Price</th><th className="text-right p-2">Disc</th><th className="text-right p-2">Total</th></tr>
            </thead>
            <tbody>
              {savedItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="p-2">{item.product_name}</td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2 text-right">{formatCurrency(item.unit_price, sym)}</td>
                  <td className="p-2 text-right">{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.total, sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-3">
            <button onClick={openPrint} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
              <Printer size={18} /> Print Invoice
            </button>
            <button onClick={startNewSale} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
              <ShoppingCart size={18} /> New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Quick Sale</h2>
            <p className="text-xs text-slate-500">Fast sale entry — no invoice list</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Invoice No *</label>
            <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="input" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer *</label>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input">
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-1.5">
              <QuickAddCustomer onAdded={(c) => { setCustomers([...customers, c]); setForm((f) => ({ ...f, customer_id: c.id })); }} />
            </div>
            <CustomerBalanceBadge customer={customers.find((c) => c.id === form.customer_id)} symbol={sym} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block flex items-center gap-1"><Calendar size={14} /> Date *</label>
            <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className="input" />
          </div>
        </div>

        <div className="space-y-2">
          <InvoiceLineItems
            customerRates={customerRates}
            customerName={customers.find((c) => c.id === form.customer_id)?.name ?? ''}
            items={items}
            products={products}
            sym={sym}
            onUpdateItem={updateItem}
            onProductSelect={onProductSelect}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onBarcodeScan={onBarcodeScan}
          />
          <QuickAddProduct onAdded={(p) => { setProducts([...products, p]); }} />
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span className="font-medium">{formatCurrency(totals.subtotal, sym)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Discount:</span>
              <input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Tax:</span>
              <input type="number" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" />
            </div>
            <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2"><span>Total:</span><span>{formatCurrency(totals.total, sym)}</span></div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-600">Payment:</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, payment_type: 'cash', paid_amount: '0' })}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${form.payment_type === 'cash' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Cash (Full)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, payment_type: 'credit' })}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${form.payment_type === 'credit' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Credit
                </button>
              </div>
            </div>

            {form.payment_type === 'credit' && (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Paid Now:</span>
                <input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm" />
              </div>
            )}
            <div className="flex justify-between font-bold text-rose-600"><span>Balance:</span><span>{formatCurrency(totals.balance, sym)}</span></div>
            {form.payment_type === 'credit' && totals.balance > 0 && (
              <p className="text-xs text-amber-600">Remaining amount will be added to the customer's outstanding balance.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} placeholder="Optional notes" />
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-all">
            <ShoppingCart size={18} /> {saving ? 'Saving...' : 'Complete Sale'}
          </button>
          <button onClick={resetForm} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Clear</button>
        </div>
      </div>

      {printOpen && settings && savedInvoice && (
        <PrintModal open onClose={() => setPrintOpen(false)} bulkCount={1}>
          <PrintFormatSelector format={printFormat} onChange={setPrintFormat} />
          <PrintDocument
            type="invoice"
            format={printFormat}
            data={{ settings, invoice: savedInvoice, customer: savedCustomer ?? undefined, items: savedItems }}
            isLast
          />
        </PrintModal>
      )}
    </div>
  );
}
