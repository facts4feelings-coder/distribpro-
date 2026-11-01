import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { checkLicense, clearActivation, type LicenseState } from '@/lib/license';

export default function LicenseExpiredScreen({ state, onReActivate }: { state: LicenseState; onReActivate: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const expired = state.status === 'expired';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">{expired ? 'License Expired' : 'License Not Activated'}</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
          {expired
            ? `Your license key ${state.key ?? ''} expired${state.expiresAt ? ` on ${state.expiresAt.toLocaleDateString()}` : ''}. Please renew your license to continue using DistribPro.`
            : 'This device does not have a valid license. Please activate DistribPro to continue.'}
        </p>

        <div className="mt-8 flex flex-col gap-3 items-center">
          <button onClick={onReActivate} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all">
            <RefreshCw size={18} /> Enter New License Key
          </button>
          <button
            onClick={() => { clearActivation(); onReActivate(); }}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Remove license from this device
          </button>
        </div>

        <p className="text-slate-600 text-xs mt-8">Contact your distributor to renew or purchase a new license key.</p>
      </div>
    </div>
  );
}
