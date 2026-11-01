import { useState } from 'react';
import { UserPlus, PackagePlus, X } from 'lucide-react';
// TODO(Phase 4): QuickAdd is used inside the invoice/sale screens, which are
// still on the local shim — it migrates together with its host pages so a
// quick-added customer/product lands in the same database the host reads.
import { supabase } from '@/lib/supabase';
import type { Customer, Product } from '@/lib/types';

export function QuickAddCustomer({ onAdded }: { onAdded: (c: Customer) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: name.trim(), phone: phone.trim() || null, opening_balance: 0, current_balance: 0, balance_type: 'receivable' })
      .select()
      .single();
    setSaving(false);
    if (error) { alert('Could not save customer: ' + error.message); return; }
    setOpen(false);
    setName('');
    setPhone('');
    onAdded(data as Customer);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
        <UserPlus size={13} /> New Customer
      </button>
    );
  }

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-700">New Customer</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name *" className="input text-sm" />
      <div className="flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="input text-sm" />
        <button type="button" onClick={save} disabled={saving} className="px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap">
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export function QuickAddProduct({ onAdded }: { onAdded: (p: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('products')
      .insert({ name: name.trim(), sku: sku.trim() || null, unit: 'pcs', purchase_price: parseFloat(salePrice) || 0, sale_price: parseFloat(salePrice) || 0, stock_quantity: 0, reorder_level: 0 })
      .select()
      .single();
    setSaving(false);
    if (error) { alert('Could not save product: ' + error.message); return; }
    setOpen(false);
    setName('');
    setSku('');
    setSalePrice('');
    onAdded(data as Product);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
        <PackagePlus size={13} /> New Product
      </button>
    );
  }

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-700">New Product</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name *" className="input text-sm" />
      <div className="flex gap-2">
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Barcode / SKU" className="input text-sm" />
        <input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Sale price" className="input text-sm w-28" />
        <button type="button" onClick={save} disabled={saving} className="px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap">
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </div>
  );
}
