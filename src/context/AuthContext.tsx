import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { localSignIn, localGetRecoveryQuestion, localResetPassword, getLocalSession, setLocalSession, type LocalUser } from '@/lib/offlineDb';

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
    getLocalSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    const { user, error } = await localSignIn(username, password);
    if (error || !user) return { error: error ?? 'Invalid username or password' };
    setLocalSession(user);
    setSession(user);
    return { error: null };
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

export { localGetRecoveryQuestion, localResetPassword };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
