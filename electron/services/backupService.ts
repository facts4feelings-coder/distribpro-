// Backup service (Phase 6): export/import in the OLD app's backup format
// (meta + data, legacy snake_case rows, decimal rupees) so backup files stay
// interchangeable between the old PGlite/Supabase app and this SQLite app —
// the same importer is the customer-data migration path for old backups.
//
// Conversions (DECISIONS D1/D2): money paisa<->rupees, quantity
// milli<->units, percent x100<->plain. Everything else passes through
// (booleans and JSON columns are native in the Drizzle schema).
//
// Import semantics mirror the old restore: per-table UPSERT (merge — nothing
// is deleted, same-id rows are updated), one transaction per table, errors
// collected per table instead of aborting the whole restore. One deliberate
// deviation: `settings` is a singleton — it is REPLACED, not upserted, so a
// restore can never leave two settings rows behind.
import { desc, eq, getTableColumns } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  settings, employees, routes, customers, suppliers, products, customerRoutes,
  customerInvoices, customerInvoiceItems, supplierInvoices, supplierInvoiceItems,
  paymentVouchers, expenseVouchers, gatePasses, salaryPayments, incomeOptions,
  userPermissions, salesmanTargets, backupHistory,
} from '../db/schema';
import { toPaisa, fromPaisa, toMilliQty, fromMilliQty, toPercentX100, fromPercentX100 } from '../lib/units';

export interface BackupFileShape {
  meta: {
    app: string;
    version: number;
    created_at: string;
    tables: Record<string, number>;
  };
  data: Record<string, Record<string, unknown>[]>;
}

interface TableSpec {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  pk: string; // camelCase key of the primary key column
  money?: string[];
  qty?: string[];
  pct?: string[];
}

const MONEY_PARTY = ['opening_balance', 'current_balance'];
const MONEY_INVOICE = ['subtotal', 'discount', 'tax', 'total', 'paid_amount', 'balance'];
const MONEY_ITEM = ['unit_price', 'total'];

export const BACKUP_TABLE_SPECS: TableSpec[] = [
  { name: 'settings', table: settings, pk: 'id', pct: ['tax_rate'] },
  { name: 'employees', table: employees, pk: 'id', money: ['salary'] },
  { name: 'routes', table: routes, pk: 'id' },
  { name: 'customers', table: customers, pk: 'id', money: MONEY_PARTY },
  { name: 'suppliers', table: suppliers, pk: 'id', money: MONEY_PARTY },
  { name: 'products', table: products, pk: 'id', money: ['purchase_price', 'sale_price'], qty: ['stock_quantity', 'reorder_level'] },
  { name: 'customer_routes', table: customerRoutes, pk: 'id' },
  { name: 'customer_invoices', table: customerInvoices, pk: 'id', money: MONEY_INVOICE },
  { name: 'customer_invoice_items', table: customerInvoiceItems, pk: 'id', money: MONEY_ITEM, qty: ['quantity'], pct: ['discount_percent'] },
  { name: 'supplier_invoices', table: supplierInvoices, pk: 'id', money: MONEY_INVOICE },
  { name: 'supplier_invoice_items', table: supplierInvoiceItems, pk: 'id', money: MONEY_ITEM, qty: ['quantity'], pct: ['discount_percent'] },
  { name: 'payment_vouchers', table: paymentVouchers, pk: 'id', money: ['amount'] },
  { name: 'expense_vouchers', table: expenseVouchers, pk: 'id', money: ['amount'] },
  { name: 'gate_passes', table: gatePasses, pk: 'id', money: ['total_amount'] },
  { name: 'salary_payments', table: salaryPayments, pk: 'id', money: ['amount'] },
  { name: 'income_options', table: incomeOptions, pk: 'id', money: ['amount'] },
  { name: 'user_permissions', table: userPermissions, pk: 'userId' },
  { name: 'salesman_targets', table: salesmanTargets, pk: 'id', money: ['target_amount'] },
];

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toLegacyRow(row: Record<string, unknown>, spec: TableSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const legacyKey = snake(key);
    if (value === null || value === undefined) { out[legacyKey] = value ?? null; continue; }
    if (spec.money?.includes(legacyKey)) out[legacyKey] = fromPaisa(value as number);
    else if (spec.qty?.includes(legacyKey)) out[legacyKey] = fromMilliQty(value as number);
    else if (spec.pct?.includes(legacyKey)) out[legacyKey] = fromPercentX100(value as number);
    else out[legacyKey] = value;
  }
  return out;
}

/** The old app's database triggers spelled return types with underscores
 * ('sales_return') while its UI always wrote hyphens ('sales-return') — the
 * mismatch meant returns never restocked (DECISIONS D12). The new app's
 * canonical spelling is the UI's hyphen form; normalize on import so any
 * underscore-typed rows in old backups land correctly. */
const INVOICE_TYPE_NORMALIZE: Record<string, string> = {
  sales_return: 'sales-return',
  purchase_return: 'purchase-return',
};

function fromLegacyRow(row: Record<string, unknown>, spec: TableSpec): Record<string, unknown> {
  const columns = getTableColumns(spec.table) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [legacyKey, value] of Object.entries(row)) {
    const key = camel(legacyKey);
    if (!(key in columns)) continue; // drop keys the new schema doesn't have
    if (value === null || value === undefined) { out[key] = null; continue; }
    if (spec.money?.includes(legacyKey)) out[key] = toPaisa(value as number);
    else if (spec.qty?.includes(legacyKey)) out[key] = toMilliQty(value as number);
    else if (spec.pct?.includes(legacyKey)) out[key] = toPercentX100(value as number);
    else out[key] = value;
  }
  if ((spec.name === 'customer_invoices' || spec.name === 'supplier_invoices')
    && typeof out.invoiceType === 'string') {
    out.invoiceType = INVOICE_TYPE_NORMALIZE[out.invoiceType] ?? out.invoiceType;
  }
  return out;
}

export async function exportBackup(db: Db): Promise<BackupFileShape> {
  const data: Record<string, Record<string, unknown>[]> = {};
  const tables: Record<string, number> = {};
  for (const spec of BACKUP_TABLE_SPECS) {
    const rows = await db.select().from(spec.table);
    data[spec.name] = rows.map((r: Record<string, unknown>) => toLegacyRow(r, spec));
    tables[spec.name] = rows.length;
  }
  return {
    meta: { app: 'DistribPro', version: 1, created_at: new Date().toISOString(), tables },
    data,
  };
}

export interface ImportResult {
  restored: { table: string; rows: number }[];
  errors: { table: string; message: string }[];
}

export async function importBackup(db: Db, backup: BackupFileShape): Promise<ImportResult> {
  if (backup?.meta?.app?.toLowerCase() !== 'distribpro' || typeof backup?.data !== 'object' || backup.data === null) {
    throw new Error('This file is not a valid DistribPro backup');
  }
  const restored: { table: string; rows: number }[] = [];
  const errors: { table: string; message: string }[] = [];
  for (const spec of BACKUP_TABLE_SPECS) {
    const rows = backup.data[spec.name];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    try {
      db.transaction((tx) => {
        if (spec.name === 'settings') {
          // Singleton: replace outright (see header note).
          tx.delete(settings).run();
          for (const row of rows) tx.insert(settings).values(fromLegacyRow(row, spec)).run();
          return;
        }
        const pkCol = (spec.table as Record<string, unknown>)[spec.pk] as never;
        for (const row of rows) {
          const values = fromLegacyRow(row, spec);
          tx.insert(spec.table).values(values)
            .onConflictDoUpdate({ target: pkCol, set: values })
            .run();
        }
      });
      restored.push({ table: spec.name, rows: rows.length });
    } catch (e) {
      errors.push({ table: spec.name, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { restored, errors };
}

// ------------------------------------------------------------- history
export interface BackupHistoryDto {
  id: string;
  createdAt: string;
  kind: string;
  fileName: string | null;
  sizeBytes: number | null;
  tableCounts: Record<string, number>;
}

export async function logBackup(
  db: Db, kind: 'download' | 'restore', fileName: string | null,
  sizeBytes: number, tableCounts: Record<string, number>,
): Promise<void> {
  await db.insert(backupHistory).values({ kind, fileName, sizeBytes, tableCounts });
}

export async function listBackupHistory(db: Db): Promise<BackupHistoryDto[]> {
  const rows = await db.select().from(backupHistory)
    .orderBy(desc(backupHistory.createdAt))
    .limit(20);
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, kind: r.kind, fileName: r.fileName,
    sizeBytes: r.sizeBytes, tableCounts: r.tableCounts ?? {},
  }));
}

export async function deleteBackupHistory(db: Db, id: string): Promise<void> {
  await db.delete(backupHistory).where(eq(backupHistory.id, id));
}
