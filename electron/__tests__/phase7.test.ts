// Phase 7 — GOLDEN DATASET QA.
// Imports migration/golden/golden-backup.json (a complete dataset in the OLD
// app's backup format, with totals verified by hand in Phase 0) into a fresh
// SQLite database through the Phase 6 importer, then checks every expected
// total from migration/golden/expected-totals.json through the real report
// dataset. This is the end-to-end proof that an old customer's data lands
// correctly in the new app.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import { importBackup, type BackupFileShape } from '../services/backupService';
import { reportsDataset } from '../services/reportsService';
import { appUsers } from '../db/schema';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
const GOLDEN_DIR = path.join(__dirname, '..', '..', 'migration', 'golden');

let dir: string;
let db: Db;
let ds: Awaited<ReturnType<typeof reportsDataset>>;
let expected: Record<string, unknown>;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p7-'));
  db = openDatabase(path.join(dir, 'golden.db'), MIGRATIONS);
  await seedIfEmpty(db);
  const backup = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, 'golden-backup.json'), 'utf8')) as BackupFileShape;
  expected = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, 'expected-totals.json'), 'utf8'));

  // The golden user_permissions row references an app user from the old app;
  // recreate that user id so the FK holds (on a real machine the restore
  // result would flag just that section if the user no longer exists).
  const permRow = backup.data.user_permissions[0] as { user_id: string };
  await db.insert(appUsers).values({
    id: permRow.user_id, username: 'golden-admin', passwordHash: 'x', salt: 'x',
  });

  const result = await importBackup(db, backup);
  expect(result.errors).toEqual([]);
  const restoredCounts = Object.fromEntries(result.restored.map((r) => [r.table, r.rows]));
  expect(restoredCounts).toEqual(expected.table_counts);

  ds = await reportsDataset(db);
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('golden dataset totals', () => {
  it('sales, returns, purchases', () => {
    const sales = ds.customerInvoices.filter((i) => i.invoiceType === 'sale');
    const sReturns = ds.customerInvoices.filter((i) => i.invoiceType === 'sales-return');
    const purchases = ds.supplierInvoices.filter((i) => i.invoiceType === 'purchase');
    const pReturns = ds.supplierInvoices.filter((i) => i.invoiceType === 'purchase-return');
    expect(sum(sales.map((i) => i.total))).toBe(expected.sales_total);
    expect(sum(sReturns.map((i) => i.total))).toBe(expected.sales_returns_total);
    expect(sum(sales.map((i) => i.total)) - sum(sReturns.map((i) => i.total))).toBe(expected.net_sales);
    expect(sum(purchases.map((i) => i.total))).toBe(expected.purchases_total);
    expect(sum(pReturns.map((i) => i.total))).toBe(expected.purchase_returns_total);
    expect(sum(purchases.map((i) => i.total)) - sum(pReturns.map((i) => i.total))).toBe(expected.net_purchases);
    expect(sum(sales.map((i) => i.balance))).toBe(expected.customer_invoice_outstanding);
    expect(sum(purchases.map((i) => i.balance))).toBe(expected.supplier_invoice_outstanding);
  });

  it('party balances, expenses, salaries, income, vouchers', () => {
    expect(sum(ds.customers.map((c) => c.currentBalance))).toBe(expected.customers_current_balance_sum);
    expect(sum(ds.suppliers.map((s) => s.currentBalance))).toBe(expected.suppliers_current_balance_sum);
    expect(sum(ds.expenseVouchers.map((e) => e.amount))).toBe(expected.expenses_total);
    expect(sum(ds.salaryPayments.map((p) => p.amount))).toBe(expected.salaries_paid_total);
    expect(sum(ds.income.map((i) => i.amount))).toBe(expected.other_income_total);
    expect(sum(ds.paymentVouchers.map((v) => v.amount))).toBe(expected.payment_vouchers_total);
  });

  it('final stock quantities and stock values', () => {
    const final = expected.stock_final as Record<string, number>;
    for (const p of ds.products) {
      expect(p.stockQuantity, p.name).toBe(final[p.name]);
    }
    expect(sum(ds.products.map((p) => p.stockQuantity * p.purchasePrice))).toBe(expected.stock_value_at_purchase);
    expect(sum(ds.products.map((p) => p.stockQuantity * p.salePrice))).toBe(expected.stock_value_at_sale);
  });
});
