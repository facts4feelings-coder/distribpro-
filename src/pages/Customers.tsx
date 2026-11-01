import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, BookOpen, Phone, MapPin, Printer, Download, Upload } from 'lucide-react';
import { api, partyDtoToLegacy, partyInputFromLegacy, invoiceDtoToCustomerLegacy, paymentVoucherDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, escapeHtml } from '@/lib/utils';
import { exportToCSV, parseCSV } from '@/lib/csv';
import { printHtml } from '@/lib/reportPrint';
import type { Customer, CustomerInvoice, PaymentVoucher } from '@/lib/types';
import Modal from '@/components/Modal';

export default function Customers() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', opening_balance: '0' });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.customers.list().catch(() => []);
    setCustomers(data.map(partyDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '', city: '', opening_balance: '0' });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      opening_balance: String(c.opening_balance),
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
      await api.customers.update(editing.id, input);
    } else {
      await api.customers.create(input);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    const { error } = await api.customers.delete(id);
    if (error) { alert(error); return; }
    load();
  };

  const handleExport = () => {
    exportToCSV('customers.csv', customers, [
      { header: 'Name', key: 'name' },
      { header: 'Phone', key: (r) => r.phone ?? '' },
      { header: 'Address', key: (r) => r.address ?? '' },
      { header: 'City', key: (r) => r.city ?? '' },
      { header: 'Opening Balance', key: (r) => String(r.opening_balance) },
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
      phone: getCol(row, 'phone') || null,
      address: getCol(row, 'address') || null,
      city: getCol(row, 'city') || null,
      opening_balance: parseFloat(getCol(row, 'opening balance')) || 0,
      current_balance: parseFloat(getCol(row, 'opening balance')) || 0,
    }));

    if (payload.length > 0) {
      const { error } = await api.customers.bulkCreate(payload.map(partyInputFromLegacy));
      if (error) {
        alert('Import failed: ' + error);
      } else {
        alert(`Imported ${payload.length} customers successfully.`);
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
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={customers.length === 0} className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <Download size={18} /> Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <Upload size={18} /> {importing ? 'Importing...' : 'Import'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No customers found. Click "Add Customer" to get started.</div>
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
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.city ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(c.current_balance, sym)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setLedgerCustomer(c)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="View Ledger">
                          <BookOpen size={16} />
                        </button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <div className="space-y-4">
          <Field label="Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Customer name" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="Phone number" />
          </Field>
          <Field label="Address">
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" placeholder="Street address" />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" placeholder="City" />
          </Field>
          <Field label="Opening Balance">
            <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="input" />
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>

      {ledgerCustomer && <LedgerModal customer={ledgerCustomer} onClose={() => setLedgerCustomer(null)} sym={sym} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function LedgerModal({ customer, onClose, sym }: { customer: Customer; onClose: () => void; sym: string }) {
  const [entries, setEntries] = useState<{ date: string; description: string; debit: number; credit: number; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [invDtos, payDtos] = await Promise.all([
        api.invoices.listForParty('customer', customer.id).catch(() => []),
        api.paymentVouchers.listForParty('customer', customer.id).catch(() => []),
      ]);
      const invoices = invDtos.map(invoiceDtoToCustomerLegacy);
      const payments = payDtos.map(paymentVoucherDtoToLegacy);

      type RawEntry = { date: string; description: string; debit: number; credit: number };
      const raw: RawEntry[] = [];

      raw.push({ date: customer.created_at, description: 'Opening Balance', debit: customer.opening_balance, credit: 0 });

      invoices.forEach((inv) => {
        raw.push({ date: inv.invoice_date, description: `Invoice ${inv.invoice_no}`, debit: inv.total, credit: inv.paid_amount });
      });
      payments.forEach((pv) => {
        raw.push({ date: pv.voucher_date, description: `Payment ${pv.voucher_no}`, debit: 0, credit: pv.amount });
      });

      raw.sort((a, b) => a.date.localeCompare(b.date));

      let bal = 0;
      const withBalance = raw.map((e) => {
        bal += e.debit - e.credit;
        return { ...e, balance: bal };
      });

      setEntries(withBalance);
      setLoading(false);
    })();
  }, [customer]);

  const printLedger = () => {
    const tableHtml = document.getElementById('ledger-table')?.outerHTML ?? '';
    const phone = customer.phone ? escapeHtml(customer.phone) : '';
    const city = customer.city ? escapeHtml(customer.city) : '';
    printHtml(
      `Ledger — ${escapeHtml(customer.name)}`,
      `<h1>${escapeHtml(customer.name)} — Ledger</h1>
      <div class="summary"><p><strong>Current Balance:</strong> ${formatCurrency(customer.current_balance, sym)}</p>${phone ? `<p>Phone: ${phone}</p>` : ''}${city ? `<p>City: ${city}</p>` : ''}</div>
      ${tableHtml}`
    );
  };

  return (
    <Modal open onClose={onClose} title={`Ledger — ${customer.name}`} size="xl">
      <div className="mb-4 p-4 bg-slate-50 rounded-lg flex items-center gap-4">
        <div>
          <p className="text-sm text-slate-500">Current Balance</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(customer.current_balance, sym)}</p>
        </div>
        {customer.phone && <div className="flex items-center gap-1.5 text-sm text-slate-600 ml-auto"><Phone size={14} /> {customer.phone}</div>}
        {customer.city && <div className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} /> {customer.city}</div>}
        <button onClick={printLedger} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
          <Printer size={16} /> Print
        </button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-8">Loading ledger...</p>
      ) : (
        <div className="overflow-x-auto">
          <table id="ledger-table" className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Debit</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Credit</th>
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
