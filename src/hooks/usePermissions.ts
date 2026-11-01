import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ALL_PERMISSIONS = [
  'dashboard', 'quick-sale', 'invoices', 'returns',
  'payment-vouchers', 'expense-vouchers', 'income-options', 'gate-passes',
  'customers', 'suppliers', 'products', 'routes', 'reports', 'print-records', 'salaries', 'settings',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];
export { ALL_PERMISSIONS };

export function usePermissions(userId: string | undefined) {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        // null row = unrestricted (full access); empty array would mean locked out
        const perms = await api.permissions.get(userId);
        setPermissions(perms);
      } catch {
        setPermissions(null);
      }
      setLoading(false);
    })();
  }, [userId]);

  return { permissions, loading };
}

export function hasPermission(permissions: string[] | null, key: PermissionKey): boolean {
  if (permissions === null) return true;
  return permissions.includes(key);
}
