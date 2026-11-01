import { useState } from 'react';
import { KeyRound, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <KeyRound size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Activate DistribPro</h1>
          <p className="text-slate-400 text-sm mt-2">Enter the license key provided by your distributor</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">License Key</label>
            <input
              value={key}
              onChange={(e) => { setKey(e.target.value.toUpperCase()); setInfo(null); setError(null); }}
              placeholder="DIST-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXNN"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {info && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-4 py-3 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck size={16} /> Valid license key</div>
              <div className="text-emerald-300/80">
                {info.expiresAt ? `Valid until ${info.expiresAt.toLocaleDateString()}` : 'Lifetime license'}
                {' · '}
                {info.maxDevices === 0 ? 'Unlimited devices' : `${info.maxDevices} device${info.maxDevices > 1 ? 's' : ''}`}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={preview} disabled={key.trim().length < 8} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-40">
              Verify
            </button>
            <button onClick={activate} disabled={!info || activating} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-40">
              Activate
            </button>
          </div>
        </div>

        <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-slate-400">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          Activation works fully offline — no internet connection is needed. Your key stays on this device only.
        </div>
      </div>
    </div>
  );
}
