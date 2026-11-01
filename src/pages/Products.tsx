import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, Download, Upload } from 'lucide-react';
import { api, productDtoToLegacy, productInputFromLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency } from '@/lib/utils';
import { exportToCSV, parseCSV } from '@/lib/csv';
import type { Product } from '@/lib/types';
import Modal from '@/components/Modal';

export default function Products() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit: 'pcs', purchase_price: '0', sale_price: '0', stock_quantity: '0', reorder_level: '0' });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.products.list().catch(() => []);
    setProducts(data.map(productDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', sku: '', category: '', unit: 'pcs', purchase_price: '0', sale_price: '0', stock_quantity: '0', reorder_level: '0' });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      category: p.category ?? '',
      unit: p.unit,
      purchase_price: String(p.purchase_price),
      sale_price: String(p.sale_price),
      stock_quantity: String(p.stock_quantity),
      reorder_level: String(p.reorder_level),
    });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      unit: form.unit,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
    };
    const input = productInputFromLegacy(payload);
    if (editing) {
      await api.products.update(editing.id, input);
    } else {
      await api.products.create(input);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const { error } = await api.products.delete(id);
    if (error) { alert(error); return; }
    load();
  };

  const handleExport = () => {
    exportToCSV('products.csv', products, [
      { header: 'Name', key: 'name' },
      { header: 'SKU', key: (r) => r.sku ?? '' },
      { header: 'Category', key: (r) => r.category ?? '' },
      { header: 'Unit', key: 'unit' },
      { header: 'Purchase Price', key: (r) => String(r.purchase_price) },
      { header: 'Sale Price', key: (r) => String(r.sale_price) },
      { header: 'Stock Quantity', key: (r) => String(r.stock_quantity) },
      { header: 'Reorder Level', key: (r) => String(r.reorder_level) },
    ]);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      alert('CSV file is empty or has no data rows.');
      setImporting(false);
      e.target.value = '';
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1);
    const getCol = (row: string[], name: string) => {
      const idx = header.indexOf(name);
      return idx >= 0 ? (row[idx] ?? '').trim() : '';
    };
    const payload = dataRows.map((row) => ({
      name: getCol(row, 'name') || 'Unnamed',
      sku: getCol(row, 'sku') || null,
      category: getCol(row, 'category') || null,
      unit: getCol(row, 'unit') || 'pcs',
      purchase_price: parseFloat(getCol(row, 'purchase price')) || 0,
      sale_price: parseFloat(getCol(row, 'sale price')) || 0,
      stock_quantity: parseFloat(getCol(row, 'stock quantity')) || 0,
      reorder_level: parseFloat(getCol(row, 'reorder level')) || 0,
    }));

    if (payload.length > 0) {
      const { error } = await api.products.bulkCreate(payload.map(productInputFromLegacy));
      if (error) {
        alert('Import failed: ' + error);
      } else {
        alert(`Imported ${payload.length} products successfully.`);
      }
    }
    setImporting(false);
    e.target.value = '';
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
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={products.length === 0} className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <Download size={18} /> Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <Upload size={18} /> {importing ? 'Importing...' : 'Import'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No products found. Click "Add Product" to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Purchase Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Sale Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const lowStock = p.stock_quantity <= p.reorder_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.category ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(p.purchase_price, sym)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">{formatCurrency(p.sale_price, sym)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${lowStock ? 'text-red-500' : 'text-slate-800'}`}>
                          {p.stock_quantity} {p.unit}
                        </span>
                        {lowStock && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => remove(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Product name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" placeholder="SKU code" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Category" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" placeholder="pcs, kg, box..." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Reorder Level</label>
              <input type="number" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Purchase Price</label>
              <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Sale Price</label>
              <input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Stock Quantity</label>
            <input type="number" step="0.01" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
