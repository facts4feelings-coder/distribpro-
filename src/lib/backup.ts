import { supabase } from '@/lib/supabase';

export interface BackupFile {
  meta: {
    app: string;
    version: number;
    created_at: string;
    tables: Record<string, number>;
  };
  data: Record<string, Record<string, unknown>[]>;
}

export const BACKUP_TABLES = [
  'settings',
  'employees',
  'routes',
  'customers',
  'suppliers',
  'products',
  'customer_routes',
  'customer_invoices',
  'customer_invoice_items',
  'supplier_invoices',
  'supplier_invoice_items',
  'payment_vouchers',
  'expense_vouchers',
  'gate_passes',
  'salary_payments',
  'income_options',
  'user_permissions',
  'salesman_targets',
] as const;

const DISPLAY_NAMES: Record<string, string> = {
  customers: 'Customers',
  suppliers: 'Suppliers',
  products: 'Products',
  routes: 'Routes',
  customer_routes: 'Customer Routes',
  customer_invoices: 'Customer Invoices',
  customer_invoice_items: 'Invoice Items',
  supplier_invoices: 'Supplier Invoices',
  supplier_invoice_items: 'Supplier Invoice Items',
  payment_vouchers: 'Payment Vouchers',
  expense_vouchers: 'Expense Vouchers',
  gate_passes: 'Gate Passes',
  employees: 'Employees',
  salary_payments: 'Salary Payments',
  settings: 'Settings',
  income_options: 'Other Income',
  user_permissions: 'User Permissions',
  salesman_targets: 'Salesman Targets',
};

export function tableName(key: string): string {
  return DISPLAY_NAMES[key] ?? key;
}

export async function createBackup(): Promise<BackupFile> {
  const data: Record<string, Record<string, unknown>[]> = {};
  const tables: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Failed to read "${table}": ${error.message}`);
    data[table] = rows ?? [];
    tables[table] = rows?.length ?? 0;
  }

  return {
    meta: { app: 'DistribPro', version: 1, created_at: new Date().toISOString(), tables },
    data,
  };
}

export function downloadBackup(backup: BackupFile): string {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().split('T')[0];
  const fileName = `distribpro-backup-${date}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return fileName;
}

export async function logBackup(kind: 'download' | 'restore', fileName: string | null, backup: BackupFile): Promise<void> {
  const size = new Blob([JSON.stringify(backup)]).size;
  await supabase.from('backup_history').insert({
    kind,
    file_name: fileName,
    size_bytes: size,
    table_counts: backup.meta.tables,
  });
}

export function parseBackupFile(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed?.meta?.app !== 'DistribPro' || typeof parsed?.data !== 'object' || parsed.data === null) {
    throw new Error('This file is not a valid DistribPro backup');
  }
  return parsed;
}

export interface RestoreResult {
  restored: { table: string; rows: number }[];
  errors: { table: string; message: string }[];
}

export async function restoreBackup(
  backup: BackupFile,
  onProgress: (label: string) => void
): Promise<RestoreResult> {
  const restored: { table: string; rows: number }[] = [];
  const errors: { table: string; message: string }[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    onProgress(table);
    const { error } = await supabase.from(table).upsert(rows);
    if (error) {
      errors.push({ table, message: error.message });
    } else {
      restored.push({ table, rows: rows.length });
    }
  }

  return { restored, errors };
}
