// Phase 6 tests: backup export/import round-trip in the legacy file format.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import { getSettings, updateSettings } from '../services/settingsService';
import {
  createCustomer, createProduct, listCustomers, listProducts,
} from '../services/masterService';
import { createInvoice, getInvoice } from '../services/transactionService';
import {
  exportBackup, importBackup, logBackup, listBackupHistory, deleteBackupHistory,
} from '../services/backupService';
import { settings as settingsT } from '../db/schema';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;

function freshDb(name: string): Db {
  return openDatabase(path.join(dir, name), MIGRATIONS);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p6-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function buildSource(): Promise<Db> {
  const db = freshDb('src.db');
  await seedIfEmpty(db);
  await updateSettings(db, { companyName: 'Roundtrip Co' });
  await createCustomer(db, { name: 'Bilal Store', phone: null, address: null, city: null, openingBalance: 0, currentBalance: 0 });
  await createProduct(db, { name: 'Oil', sku: null, category: null, unit: 'pcs', purchasePrice: 80, salePrice: 100, stockQuantity: 100, reorderLevel: 0 });
  const cust = (await listCustomers(db))[0];
  const prod = (await listProducts(db))[0];
  await createInvoice(db, 'customer', {
    invoiceNo: 'INV-1', partyId: cust.id, invoiceDate: '2026-10-01', dueDate: null,
    subtotal: 250.5, discount: 0, tax: 0, total: 250.5, paidAmount: 0, balance: 250.5,
    status: 'unpaid', paymentType: 'credit', notes: null, invoiceType: 'sale',
  }, [{ productId: prod.id, productName: 'Oil', quantity: 2.5, unitPrice: 100.2, discountPercent: 0, total: 250.5 }]);
  return db;
}

describe('backup round-trip', () => {
  it('exports legacy decimal rows and imports them into a fresh database', async () => {
    const src = await buildSource();
    const backup = await exportBackup(src);
    expect(backup.meta.app).toBe('DistribPro');
    const prod = backup.data.products[0];
    expect(prod.stock_quantity).toBe(97.5); // milli -> decimal units
    expect(prod.purchase_price).toBe(80); // paisa -> rupees
    const inv = backup.data.customer_invoices[0];
    expect(inv.total).toBe(250.5);
    expect(backup.data.customer_invoice_items[0].quantity).toBe(2.5);

    const dst = freshDb('dst.db');
    await seedIfEmpty(dst);
    const result = await importBackup(dst, backup);
    expect(result.errors).toEqual([]);
    expect(result.restored.length).toBeGreaterThan(3);

    const products = await listProducts(dst);
    expect(products[0].stockQuantity).toBe(97.5);
    const customers = await listCustomers(dst);
    expect(customers.find((c) => c.name === 'Bilal Store')?.currentBalance).toBe(250.5);
    // settings replaced, not duplicated
    expect((await getSettings(dst)).companyName).toBe('Roundtrip Co');
    const settingsRows = await dst.select().from(settingsT);
    expect(settingsRows).toHaveLength(1);
  });

  it('importing twice is idempotent (upsert merge)', async () => {
    const src = await buildSource();
    const backup = await exportBackup(src);
    const dst = freshDb('dst.db');
    await seedIfEmpty(dst);
    await importBackup(dst, backup);
    const again = await importBackup(dst, backup);
    expect(again.errors).toEqual([]);
    expect(await listProducts(dst)).toHaveLength(1);
    expect(await listCustomers(dst)).toHaveLength(1);
    const srcInv = (await exportBackup(src)).data.customer_invoices[0];
    const got = await getInvoice(dst, 'customer', srcInv.id as string);
    expect(got?.total).toBe(250.5);
  });

  it('rejects files that are not DistribPro backups', async () => {
    const dst = freshDb('dst.db');
    await seedIfEmpty(dst);
    await expect(importBackup(dst, { meta: { app: 'Other', version: 1, created_at: '', tables: {} }, data: {} }))
      .rejects.toThrow('not a valid DistribPro backup');
  });

  it('history log/list/delete', async () => {
    const db = freshDb('h.db');
    await seedIfEmpty(db);
    await logBackup(db, 'download', 'backup.json', 1234, { customers: 2 });
    const rows = await listBackupHistory(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'download', fileName: 'backup.json', sizeBytes: 1234 });
    expect(rows[0].tableCounts).toEqual({ customers: 2 });
    await deleteBackupHistory(db, rows[0].id);
    expect(await listBackupHistory(db)).toHaveLength(0);
  });
});
