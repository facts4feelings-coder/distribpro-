import { useState, type ReactNode } from 'react';
import { Package, User, Lock, ArrowRight, KeyRound, Zap, ShieldCheck, Boxes } from 'lucide-react';
import { useAuth, localGetRecoveryQuestion, localResetPassword } from '@/context/AuthContext';

type Mode = 'login' | 'forgot-username' | 'forgot-answer' | 'forgot-reset' | 'forgot-done';

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#F3F5F4]">
      <aside className="hidden lg:flex w-[44%] max-w-[540px] flex-col justify-between bg-gradient-to-br from-slate-950 via-[#0A1710] to-emerald-900 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Package size={22} className="text-white" />
          </div>
          <div>
            <p className="font-extrabold text-lg leading-tight tracking-tight">DistribPro</p>
            <p className="text-[11px] text-emerald-200/50 font-medium leading-tight">Distribution Manager</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-[1.15] tracking-tight">
            Run your whole distribution from one place.
          </h2>
          <p className="mt-4 text-[15px] text-emerald-100/60 leading-relaxed max-w-md">
            Invoices, stock, routes and recoveries — fast, fully offline, and always in your control.
          </p>
          <div className="mt-9 space-y-4">
            {[
              { icon: Zap, text: 'Quick Sale in seconds, even without internet' },
              { icon: Boxes, text: 'Live stock on every product and route' },
              { icon: ShieldCheck, text: 'Your business data stays on your own computer' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/[0.07] ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={17} className="text-emerald-300" />
                </div>
                <p className="text-sm font-medium text-emerald-50/85">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-emerald-100/35 font-medium">DistribPro · Distribution Management System</p>
      </aside>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-600/25 mb-3">
              <Package size={28} className="text-white" />
            </div>
            <p className="font-extrabold text-slate-900 text-lg tracking-tight">DistribPro</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function Login() {
  const { signInWithUsername } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForgotState = () => {
    setQuestion('');
    setAnswer('');
    setNewPassword('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signInWithUsername(username.trim(), password);
    setBusy(false);
    if (error) setError(error);
  };

  const fetchQuestion = async () => {
    setError(null);
    if (!username.trim()) {
      setError('Please enter your username first');
      return;
    }
    setBusy(true);
    try {
      const result = await localGetRecoveryQuestion(username.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setQuestion(result.question ?? '');
      setMode('forgot-answer');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      const result = await localResetPassword(username.trim(), answer, newPassword);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMode('forgot-done');
    } finally {
      setBusy(false);
    }
  };

  if (mode !== 'login') {
    return (
      <AuthShell>
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/25">
                <KeyRound size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
              <p className="text-sm text-slate-500 mt-1">Answer your security question to set a new password</p>
            </div>

            {mode === 'forgot-username' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Username</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
                <button onClick={fetchQuestion} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                  {busy ? 'Please wait...' : 'Continue'}
                </button>
                <button onClick={() => { setMode('login'); resetForgotState(); }} className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium transition-all">
                  Back to sign in
                </button>
              </div>
            )}

            {mode === 'forgot-answer' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Security Question</p>
                  <p className="text-sm font-medium text-slate-800">{question}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Your Answer</label>
                  <input
                    type="text"
                    autoFocus
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                    placeholder="Type your answer (not case-sensitive)"
                  />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}
                <button onClick={submitReset} disabled={busy || !answer.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                  {busy ? 'Please wait...' : 'Verify Answer'}
                </button>
                <button onClick={() => { setMode('forgot-username'); resetForgotState(); }} className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium transition-all">
                  Back
                </button>
                <p className="text-xs text-slate-400 text-center">
                  After a correct answer you will set a new password.
                </p>
              </div>
            )}

            {mode === 'forgot-reset' && null}

            {mode === 'forgot-done' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-emerald-700">Your password has been reset successfully.</p>
                </div>
                <button onClick={() => { setMode('login'); resetForgotState(); setPassword(''); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20">
                  Sign In <ArrowRight size={18} />
                </button>
              </div>
            )}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/25">
              <Package size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">DistribPro</h1>
            <p className="text-sm text-slate-500 mt-1">Distribution Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-800"
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {busy ? 'Please wait...' : 'Sign In'}
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="text-center mt-4">
            <button onClick={() => { setMode('forgot-username'); setError(null); }} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-all">
              Forgot password?
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center mt-6">
            Use your admin username and password to access the system.
          </p>
    </AuthShell>
  );
}
