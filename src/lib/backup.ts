// Backup helpers (renderer side). Since Phase 6 the data work happens in the
// Electron main process (backupService) via window.api; this module keeps the
// file-format types, the download/parse helpers, and thin wrappers with the
// same signatures BackupManager has always used.
import { api, type BackupFileShape, type BackupImportResult } from './api';

export type BackupFile = BackupFileShape;
export type RestoreResult = BackupImportResult;

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
  return api.backup.export();
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
  await api.backup.log(kind, fileName, size, backup.meta.tables);
}

export function parseBackupFile(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed?.meta?.app !== 'DistribPro' || typeof parsed?.data !== 'object' || parsed.data === null) {
    throw new Error('This file is not a valid DistribPro backup');
  }
  return parsed;
}

export async function restoreBackup(
  backup: BackupFile,
  onProgress: (label: string) => void
): Promise<RestoreResult> {
  // The main process restores table-by-table in FK order inside per-table
  // transactions; progress is reported once per section as it completes.
  const result = await api.backup.import(backup);
  for (const r of result.restored) onProgress(r.table);
  return result;
}
