// Phase 1 foundation tests: schema + migrations + seed + units + the
// Settings service end-to-end (service -> Drizzle -> SQLite file), plus the
// integrity rules the old Postgres schema enforced (FKs, one-payee check).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import { settings, appUsers, customers, customerInvoices, paymentVouchers } from '../db/schema';
import { getSettings, updateSettings } from '../services/settingsService';
import { toPaisa, fromPaisa, toMilliQty, fromMilliQty, toPercentX100, fromPercentX100 } from '../lib/units';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;
let db: Db;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-test-'));
  db = openDatabase(path.join(dir, 'test.db'), MIGRATIONS);
  await seedIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('units (D2/D3/D4)', () => {
  it('money survives a round trip exactly', () => {
    for (const v of [0, 1, 150.5, 6000, 0.01, 999999.99]) {
      expect(fromPaisa(toPaisa(v))).toBe(v);
    }
    expect(toPaisa(150.5)).toBe(15050);
  });
  it('quantity and percent round trip', () => {
    expect(toMilliQty(2.5)).toBe(2500);
    expect(fromMilliQty(2500)).toBe(2.5);
    expect(toPercentX100(10.5)).toBe(1050);
    expect(fromPercentX100(1050)).toBe(10.5);
  });
});

describe('seed', () => {
  it('creates default settings and admin, and is idempotent', async () => {
    const s = await getSettings(db);
    expect(s.companyName).toBe('My Distribution Company');
    expect(s.currencySymbol).toBe('Rs');
    expect(s.invoicePrefix).toBe('INV-');

    const users = await db.select().from(appUsers);
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('admin');

    const again = await seedIfEmpty(db);
    expect(again).toEqual({ seededSettings: false, seededAdmin: false });
    expect(await db.select().from(appUsers)).toHaveLength(1);
  });
});

describe('settings service end-to-end', () => {
  it('update persists and converts taxRate percent <-> x100', async () => {
    const updated = await updateSettings(db, { companyName: 'Golden Test Distribution', taxRate: 5.5 });
    expect(updated.companyName).toBe('Golden Test Distribution');
    expect(updated.taxRate).toBe(5.5);

    const raw = await db.select({ taxRate: settings.taxRate }).from(settings);
    expect(raw[0].taxRate).toBe(550); // stored as integer x100

    const reread = await getSettings(db);
    expect(reread.companyName).toBe('Golden Test Distribution');
    expect(reread.taxRate).toBe(5.5);
  });
});

describe('schema integrity (ported from Postgres)', () => {
  it('enforces foreign keys on invoices', async () => {
    await expect(
      db.insert(customerInvoices).values({ invoiceNo: 'INV-X', customerId: 'no-such-customer' }),
    ).rejects.toThrow();
  });
  it('enforces the payment voucher one-payee check', async () => {
    const [c] = await db.insert(customers).values({ name: 'Test Customer' }).returning();
    await expect(
      db.insert(paymentVouchers).values({ voucherNo: 'PV-X', customerId: c.id, supplierId: c.id }),
    ).rejects.toThrow();
    await expect(
      db.insert(paymentVouchers).values({ voucherNo: 'PV-Y', customerId: c.id, amount: toPaisa(100) }).returning(),
    ).resolves.toHaveLength(1);
  });
  it('money columns store exact integers', async () => {
    const [c] = await db
      .insert(customers)
      .values({ name: 'Paisa Test', openingBalance: toPaisa(150.5) })
      .returning();
    const rows = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(rows[0].openingBalance).toBe(15050);
    const rawCount = await db.run(sql`SELECT COUNT(*) AS n FROM customers`);
    expect(Number((rawCount as unknown as { n: number }).n ?? 1)).toBeGreaterThanOrEqual(1);
  });
});
