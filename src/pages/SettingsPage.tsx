import { useEffect, useState, useCallback } from 'react';
import { Save, Building2, Printer, Check, UserPlus, Trash2, Shield, User, Lock, DatabaseBackup } from 'lucide-react';
import { api, settingsDtoToLegacy, settingsLegacyToDtoPatch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ALL_PERMISSIONS } from '@/hooks/usePermissions';
import type { Settings } from '@/lib/types';
import Modal from '@/components/Modal';
import BackupManager from '@/components/BackupManager';
import LicenseKeyGenerator from '@/components/LicenseKeyGenerator';
import { checkLicense, clearActivation } from '@/lib/license';

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard', 'quick-sale': 'Quick Sale', 'invoices': 'Invoices',
  'returns': 'Returns', 'payment-vouchers': 'Payment Recovery',
  'expense-vouchers': 'Expense Vouchers', 'income-options': 'Other Income', 'gate-passes': 'Gate Passes',
  'customers': 'Customers', 'suppliers': 'Suppliers', 'products': 'Products & Stock',
  'routes': 'Routes & Shops', 'reports': 'Reports', 'print-records': 'Print Records', 'salaries': 'Employee Salaries', 'settings': 'Settings',
};

export default function SettingsPage() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    company_name: '', company_address: '', company_phone: '', company_email: '',
    currency_symbol: 'Rs', tax_rate: '0',
    invoice_prefix: 'INV-', supplier_invoice_prefix: 'SUP-',
    payment_voucher_prefix: 'PV-', expense_voucher_prefix: 'EV-', gate_pass_prefix: 'GP-',
    sales_return_prefix: 'SR-', purchase_return_prefix: 'PR-',
    default_print_format: 'a4', thermal_printer_width: '80mm', invoice_footer_note: 'Thank you for your business!',
  });

  // Admin users state
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPerms, setNewAdminPerms] = useState<string[]>([...ALL_PERMISSIONS]);
  const [restrictNewAdmin, setRestrictNewAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState<{ id: string; username: string }[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [permMap, setPermMap] = useState<Record<string, string[]>>({});
  const [editingPermsUser, setEditingPermsUser] = useState<{ id: string; username: string } | null>(null);
  const [editingPerms, setEditingPerms] = useState<string[]>([]);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingRestricted, setEditingRestricted] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const dto = await api.settings.get().catch(() => null);
    const data = dto ? settingsDtoToLegacy(dto) : null;
    if (data) {
      setSettings(data);
      setForm({
        company_name: data.company_name, company_address: data.company_address ?? '', company_phone: data.company_phone ?? '',
        company_email: data.company_email ?? '', currency_symbol: data.currency_symbol, tax_rate: String(data.tax_rate),
        invoice_prefix: data.invoice_prefix, supplier_invoice_prefix: data.supplier_invoice_prefix,
        payment_voucher_prefix: data.payment_voucher_prefix, expense_voucher_prefix: data.expense_voucher_prefix,
        gate_pass_prefix: data.gate_pass_prefix, sales_return_prefix: data.sales_return_prefix,
        purchase_return_prefix: data.purchase_return_prefix, default_print_format: data.default_print_format,
        thermal_printer_width: data.thermal_printer_width,
        invoice_footer_note: (data as { invoice_footer_note?: string | null }).invoice_footer_note ?? 'Thank you for your business!',
      });
    }
    setLoading(false);
  }, []);

  const loadAdminUsers = useCallback(async () => {
    setAdminLoading(true);
    const [usersRes, permRows] = await Promise.all([
      api.users.list().catch(() => ({ users: [] as { id: string; username: string }[] })),
      api.permissions.listAll().catch(() => [] as { userId: string; permissions: string[] }[]),
    ]);
    if (Array.isArray(usersRes.users)) {
      setAdminUsers(usersRes.users.map((u) => ({ id: u.id, username: u.username })));
    }
    const map: Record<string, string[]> = {};
    for (const row of permRows) {
      map[row.userId] = row.permissions ?? [];
    }
    setPermMap(map);
    setAdminLoading(false);
  }, []);

  useEffect(() => { load(); loadAdminUsers(); }, [load, loadAdminUsers]);

  const save = async () => {
    setSaving(true);
    const payload = {
      company_name: form.company_name, company_address: form.company_address || null,
      company_phone: form.company_phone || null, company_email: form.company_email || null,
      currency_symbol: form.currency_symbol, tax_rate: parseFloat(form.tax_rate) || 0,
      invoice_prefix: form.invoice_prefix, supplier_invoice_prefix: form.supplier_invoice_prefix,
      payment_voucher_prefix: form.payment_voucher_prefix, expense_voucher_prefix: form.expense_voucher_prefix,
      gate_pass_prefix: form.gate_pass_prefix, sales_return_prefix: form.sales_return_prefix,
      purchase_return_prefix: form.purchase_return_prefix, default_print_format: form.default_print_format,
      thermal_printer_width: form.thermal_printer_width, invoice_footer_note: form.invoice_footer_note || null,
    };
    // SQLite always has exactly one settings row (seeded on first run);
    // the service updates it in place.
    void settings;
    await api.settings.update(settingsLegacyToDtoPatch(payload)).catch(() => null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };

  const createAdmin = async () => {
    setAdminError(null);
    setAdminBusy(true);
    const result = await api.users.create(
      newAdminUsername,
      newAdminPassword,
      restrictNewAdmin ? newAdminPerms : null
    );
    setAdminBusy(false);
    if (result.error) {
      setAdminError(result.error);
      return;
    }
    setAdminModalOpen(false);
    setNewAdminUsername('');
    setNewAdminPassword('');
    setRestrictNewAdmin(false);
    setNewAdminPerms([...ALL_PERMISSIONS]);
    loadAdminUsers();
  };

  const deleteAdmin = async (userId: string, username: string) => {
    if (!confirm(`Remove admin access for ${username}?`)) return;
    await api.users.delete(userId);
    loadAdminUsers();
  };

  const savePerms = async () => {
    if (!editingPermsUser) return;
    setPermBusy(true);
    const result = await api.users.update({
      userId: editingPermsUser.id,
      username: editingUsername,
      permissions: editingRestricted ? editingPerms : null,
      recoveryQuestion: recoveryQuestion.trim() || null,
      recoveryAnswer: recoveryAnswer.trim() || null,
    });
    setPermBusy(false);
    if (result.error) {
      setAdminError(result.error);
      return;
    }
    setEditingPermsUser(null);
    loadAdminUsers();
  };

  const openPermsEditor = (u: { id: string; username: string }) => {
    const existing = permMap[u.id];
    setEditingPermsUser(u);
    setEditingUsername(u.username);
    setEditingPerms(existing ? [...existing] : [...ALL_PERMISSIONS]);
    setEditingRestricted(Boolean(existing));
    setRecoveryQuestion('');
    setRecoveryAnswer('');
    setAdminError(null);
  };

  const togglePerm = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Company Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Building2 size={20} className="text-emerald-600" /></div>
          <h3 className="font-bold text-slate-800">Company Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 mb-1.5 block">Company Name *</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="input" /></div>
          <div className="md:col-span-2"><label className="text-sm font-medium text-slate-700 mb-1.5 block">Address</label><input value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</label><input value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label><input value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Currency Symbol</label><input value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Default Tax Rate (%)</label><input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="input" /></div>
        </div>
      </div>

      {/* Admin User Management */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Shield size={20} className="text-emerald-600" /></div>
            <h3 className="font-bold text-slate-800">Admin Users</h3>
          </div>
          <button onClick={() => { setAdminError(null); setAdminModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
            <UserPlus size={16} /> Add Admin
          </button>
        </div>
        {adminLoading ? (
          <p className="text-slate-400 text-sm">Loading admin users...</p>
        ) : adminUsers.length === 0 ? (
          <p className="text-slate-400 text-sm">No admin users found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {adminUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><User size={14} className="text-slate-500" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.username}</p>
                    {u.id === session?.id ? (
                      <span className="text-xs text-emerald-600">You (current session)</span>
                    ) : permMap[u.id] ? (
                      <span className="text-xs text-amber-600">Restricted — {permMap[u.id].length} of {ALL_PERMISSIONS.length} sections</span>
                    ) : (
                      <span className="text-xs text-slate-400">Full access</span>
                    )}
                  </div>
                </div>
                {u.id !== session?.id && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPermsEditor(u)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all" title="Edit restrictions">
                      <Lock size={16} />
                    </button>
                    <button onClick={() => deleteAdmin(u.id, u.username)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove admin">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice Prefixes */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-4">Document Number Prefixes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer Invoice Prefix</label><input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Supplier Invoice Prefix</label><input value={form.supplier_invoice_prefix} onChange={(e) => setForm({ ...form, supplier_invoice_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Payment Voucher Prefix</label><input value={form.payment_voucher_prefix} onChange={(e) => setForm({ ...form, payment_voucher_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Expense Voucher Prefix</label><input value={form.expense_voucher_prefix} onChange={(e) => setForm({ ...form, expense_voucher_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Gate Pass Prefix</label><input value={form.gate_pass_prefix} onChange={(e) => setForm({ ...form, gate_pass_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Sales Return Prefix</label><input value={form.sales_return_prefix} onChange={(e) => setForm({ ...form, sales_return_prefix: e.target.value })} className="input" /></div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Purchase Return Prefix</label><input value={form.purchase_return_prefix} onChange={(e) => setForm({ ...form, purchase_return_prefix: e.target.value })} className="input" /></div>
        </div>
      </div>

      {/* Printer Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center"><Printer size={20} className="text-violet-600" /></div>
          <h3 className="font-bold text-slate-800">Print Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Default Print Format</label>
            <select value={form.default_print_format} onChange={(e) => setForm({ ...form, default_print_format: e.target.value })} className="input">
              <option value="a4">A4</option>
              <option value="a5">A5</option>
              <option value="thermal-58">Thermal 58mm</option>
              <option value="thermal-80">Thermal 80mm</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Thermal Printer Width</label>
            <select value={form.thermal_printer_width} onChange={(e) => setForm({ ...form, thermal_printer_width: e.target.value })} className="input">
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="112mm">112mm</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Invoice Footer Note</label>
          <textarea value={form.invoice_footer_note} onChange={(e) => setForm({ ...form, invoice_footer_note: e.target.value })} className="input" rows={2} placeholder="Note printed at the bottom of every invoice — leave empty to hide" />
          <p className="text-xs text-slate-400 mt-1">Shows at the bottom of printed invoices, sales returns and purchase invoices. Leave empty to hide it.</p>
        </div>
      </div>

      {/* License Key Generator (admin only) */}
      <LicenseKeyGenerator />

      {/* License status on this device */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-2">License on This Device</h3>
        {(() => {
          const st = checkLicense();
          return (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-slate-800">{st.key ?? '—'}</p>
                <p className="text-xs text-slate-400">
                  {st.status === 'active' ? (st.expiresAt ? `Active — valid until ${st.expiresAt.toLocaleDateString()}` : 'Active — lifetime license') : st.status}
                </p>
              </div>
              <button
                onClick={() => { if (confirm('Remove the license from this device? The app will lock until a new key is entered.')) { clearActivation(); window.location.reload(); } }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-all"
              >
                Deactivate
              </button>
            </div>
          );
        })()}
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><DatabaseBackup size={20} className="text-teal-600" /></div>
          <div>
            <h3 className="font-bold text-slate-800">Backup & Restore</h3>
            <p className="text-xs text-slate-400">Download a full copy of your data, or bring it back on any device</p>
          </div>
        </div>
        <BackupManager />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">
          {saved ? <><Check size={18} /> Saved!</> : <><Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}</>}
        </button>
      </div>

      {/* Add Admin Modal */}
      <Modal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} title="Add New Admin User">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Username *</label>
            <input type="text" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} className="input" placeholder="e.g. ali123 (letters, numbers, dot, dash, underscore)" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password *</label>
            <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} className="input" placeholder="Minimum 6 characters" />
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={restrictNewAdmin} onChange={(e) => setRestrictNewAdmin(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-sm font-medium text-slate-700">Restrict this user to selected sections only</span>
            </label>
            {restrictNewAdmin && (
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {ALL_PERMISSIONS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={newAdminPerms.includes(key)} onChange={() => togglePerm(newAdminPerms, setNewAdminPerms, key)} className="w-3.5 h-3.5 accent-emerald-600" />
                    {PERMISSION_LABELS[key]}
                  </label>
                ))}
              </div>
            )}
          </div>
          {adminError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{adminError}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={createAdmin} disabled={adminBusy} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-all disabled:opacity-50">{adminBusy ? 'Creating...' : 'Create Admin'}</button>
            <button onClick={() => setAdminModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Edit Restrictions Modal */}
      <Modal open={Boolean(editingPermsUser)} onClose={() => setEditingPermsUser(null)} title={`Restrictions — ${editingPermsUser?.username ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Username</label>
            <input type="text" value={editingUsername} onChange={(e) => setEditingUsername(e.target.value)} className="input" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editingRestricted} onChange={(e) => setEditingRestricted(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Restrict this user to selected sections only</span>
          </label>
          {editingRestricted && (
            <div className="grid grid-cols-2 gap-1.5 border border-slate-200 rounded-lg p-4">
              {ALL_PERMISSIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={editingPerms.includes(key)} onChange={() => togglePerm(editingPerms, setEditingPerms, key)} className="w-3.5 h-3.5 accent-emerald-600" />
                  {PERMISSION_LABELS[key]}
                </label>
              ))}
            </div>
          )}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Password recovery (forgot password)</p>
            <p className="text-xs text-slate-400">Set a question and answer so this user can reset a forgotten password from the login screen. Leave blank to keep the current one.</p>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Security Question</label>
              <input type="text" value={recoveryQuestion} onChange={(e) => setRecoveryQuestion(e.target.value)} className="input" placeholder="e.g. What is your mother's first name?" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Answer</label>
              <input type="text" value={recoveryAnswer} onChange={(e) => setRecoveryAnswer(e.target.value)} className="input" placeholder="Type the answer (not case-sensitive)" />
            </div>
          </div>
          {adminError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{adminError}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={savePerms} disabled={permBusy} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-all disabled:opacity-50">{permBusy ? 'Saving...' : 'Save Restrictions'}</button>
            <button onClick={() => setEditingPermsUser(null)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
