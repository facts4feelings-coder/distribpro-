import { useState } from 'react';
import { KeyRound, ShieldCheck, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { verifyLicenseKey, storeActivation, type LicenseInfo } from '@/lib/license';

export default function ActivationScreen({ onActivated }: { onActivated: (key: string, info: LicenseInfo) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [activating, setActivating] = useState(false);

  const preview = () => {
    setError(null);
    setInfo(null);
    const v = verifyLicenseKey(key);
    if (!v.valid) {
      setError(v.error ?? 'Invalid license key');
      return;
    }
    setInfo(v.info ?? null);
  };

  const activate = () => {
    setActivating(true);
    const v = verifyLicenseKey(key);
    if (!v.valid || !v.info) {
      setError(v.error ?? 'Invalid license key');
      setActivating(false);
      return;
    }
    if (v.info.expiresAt && v.info.expiresAt.getTime() < Date.now()) {
      setError('This license key has expired. Please contact your provider.');
      setActivating(false);
      return;
    }
    storeActivation(key);
    onActivated(key, v.info);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0A1710] to-emerald-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Package size={18} className="text-white" />
          </div>
          <p className="font-extrabold text-white text-lg tracking-tight">DistribPro</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/25">
              <KeyRound size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Activate DistribPro</h1>
            <p className="text-slate-500 text-sm mt-1.5 text-center">Enter the license key provided by your distributor</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">License Key</label>
              <input
                value={key}
                onChange={(e) => { setKey(e.target.value.toUpperCase()); setInfo(null); setError(null); }}
                placeholder="DIST-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXNN"
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 font-mono text-sm tracking-wider placeholder:text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
                <AlertTriangle size={16} className="flex-shrink-0" /> {error}
              </div>
            )}

            {info && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} /> Valid license key</div>
                <div className="text-emerald-600/80">
                  {info.expiresAt ? `Valid until ${info.expiresAt.toLocaleDateString()}` : 'Lifetime license'}
                  {' · '}
                  {info.maxDevices === 0 ? 'Unlimited devices' : `${info.maxDevices} device${info.maxDevices > 1 ? 's' : ''}`}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={preview} disabled={key.trim().length < 8} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all disabled:opacity-40">
                Verify
              </button>
              <button onClick={activate} disabled={!info || activating} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40">
                {activating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-emerald-100/60">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300/70" />
          Activation works fully offline — no internet connection is needed. Your key stays on this device only.
        </div>
      </div>
    </div>
  );
}
