import { useState } from 'react';
import { api, type LicenseDto } from '@/lib/api';
import {
  generateLicenseKey, verifyLicenseKey, getDeviceId,
  type LicenseInfo,
} from '@/lib/license';
import { KeyRound, Copy, Check, Trash2, Ban, RotateCcw } from 'lucide-react';

interface LicenseRow {
  id: string;
  license_key: string;
  customer_name: string;
  max_devices: number;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export default function LicenseKeyGenerator() {
  const [customerName, setCustomerName] = useState('');
  const [expiryMode, setExpiryMode] = useState<'lifetime' | 'date'>('lifetime');
  const [expiryDate, setExpiryDate] = useState('');
  const [maxDevices, setMaxDevices] = useState('1');
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadKeys = async () => {
    const data = await api.licenses.list().catch(() => [] as LicenseDto[]);
    setRows(data.map((d) => ({
      id: d.id, license_key: d.licenseKey, customer_name: d.customerName,
      max_devices: d.maxDevices, expires_at: d.expiresAt, is_active: d.isActive,
      notes: d.notes, created_at: d.createdAt,
    })));
    setLoaded(true);
  };

  if (!loaded) {
    loadKeys();
  }

  const generate = async () => {
    setError(null);
    const maxDev = parseInt(maxDevices, 10) || 0;
    const expiresAt = expiryMode === 'date' && expiryDate ? new Date(`${expiryDate}T23:59:59`) : null;
    if (expiryMode === 'date' && !expiryDate) {
      setError('Pick an expiry date or choose Lifetime');
      return;
    }
    setSaving(true);
    const key = generateLicenseKey({ customerName: customerName.trim() || 'Unnamed', expiresAt, maxDevices: maxDev });
    const v = verifyLicenseKey(key);
    if (!v.valid) {
      setError('Key generation failed, please try again');
      setSaving(false);
      return;
    }
    const { error: dbError } = await api.licenses.create({
      licenseKey: key,
      customerName: customerName.trim() || 'Unnamed',
      maxDevices: maxDev,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isActive: true,
    });
    if (dbError) {
      setError('Could not save key to the database: ' + dbError);
      setSaving(false);
      return;
    }
    setGenerated(key);
    setSaving(false);
    loadKeys();
  };

  const copy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleActive = async (row: LicenseRow) => {
    await api.licenses.setActive(row.id, !row.is_active);
    loadKeys();
  };

  const removeKey = async (row: LicenseRow) => {
    if (!confirm(`Delete license key ${row.license_key}? Devices using it will stop working on next check.`)) return;
    await api.licenses.delete(row.id);
    loadKeys();
  };

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><KeyRound size={20} className="text-amber-600" /></div>
          <div>
            <h3 className="font-bold text-slate-800">Generate License Key</h3>
            <p className="text-xs text-slate-400">Create a new key and give it to your customer — works fully offline</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer Name</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="e.g. Ali Traders" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Validity</label>
            <select value={expiryMode} onChange={(e) => setExpiryMode(e.target.value as 'lifetime' | 'date')} className="input">
              <option value="lifetime">Lifetime</option>
              <option value="date">Expires on date</option>
            </select>
          </div>
          {expiryMode === 'date' ? (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="input" />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Max Devices</label>
              <select value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} className="input">
                <option value="0">Unlimited</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          {expiryMode === 'date' && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Max Devices</label>
              <select value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} className="input">
                <option value="0">Unlimited</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mt-4">{error}</div>}
        <div className="flex justify-end mt-4">
          <button onClick={generate} disabled={saving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50">
            {saving ? 'Generating...' : 'Generate Key'}
          </button>
        </div>

        {generated && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase mb-2">New license key</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 font-mono text-sm tracking-wider text-slate-800">{generated}</code>
              <button onClick={copy} className="p-2 bg-white border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-all" title="Copy">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-emerald-600 mt-2">Saved to your key list below — share this key with the customer.</p>
          </div>
        )}
      </div>

      {/* Issued keys list */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-4">Issued Keys</h3>
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm">No keys generated yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const info: LicenseInfo | undefined = verifyLicenseKey(row.license_key).info;
              const expired = info?.expiresAt ? new Date(info.expiresAt) < new Date() : false;
              return (
                <div key={row.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-slate-800 truncate">{row.license_key}</p>
                    <p className="text-xs text-slate-400">
                      {row.customer_name || 'Unnamed'}
                      {' · '}
                      {info?.expiresAt ? (expired ? <span className="text-red-500">Expired {new Date(info.expiresAt).toLocaleDateString()}</span> : `Valid until ${new Date(info.expiresAt).toLocaleDateString()}`) : 'Lifetime'}
                      {' · '}
                      {row.max_devices === 0 ? 'Unlimited devices' : `${row.max_devices} device${row.max_devices > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {row.is_active ? 'Active' : 'Disabled'}
                    </span>
                    <button onClick={() => toggleActive(row)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all" title={row.is_active ? 'Disable key' : 'Re-enable key'}>
                      {row.is_active ? <Ban size={16} /> : <RotateCcw size={16} />}
                    </button>
                    <button onClick={() => removeKey(row)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete key">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device info */}
      <p className="text-xs text-slate-400">This device ID: <code className="font-mono">{getDeviceId()}</code></p>
    </div>
  );
}
