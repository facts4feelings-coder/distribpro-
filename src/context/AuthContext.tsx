import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type SessionUser } from '@/lib/api';

// Phase 2: auth now runs against SQLite in the main process (authService).
// The public surface of this module is unchanged (Login.tsx, App.tsx and
// Layout.tsx keep working as-is): same context shape, same localStorage
// session key and format, same recovery helper names.
export type LocalUser = SessionUser;

const SESSION_KEY = 'distribpro_local_session';

function getLocalSession(): LocalUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

function setLocalSession(user: LocalUser | null): void {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

interface AuthContextType {
  session: LocalUser | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getLocalSession());
    setLoading(false);
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const { user, error } = await api.auth.signIn(username, password);
      if (error || !user) return { error: error ?? 'Invalid username or password' };
      setLocalSession(user);
      setSession(user);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign-in failed' };
    }
  };

  const signOut = async () => {
    setLocalSession(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signInWithUsername, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export async function localGetRecoveryQuestion(
  username: string,
): Promise<{ question?: string; error?: string }> {
  try {
    return await api.auth.recoveryQuestion(username);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not find a recovery question for this username' };
  }
}

export async function localResetPassword(
  username: string,
  answer: string,
  newPassword: string,
): Promise<{ error?: string }> {
  try {
    return await api.auth.resetPassword(username, answer, newPassword);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not reset the password for this username' };
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
