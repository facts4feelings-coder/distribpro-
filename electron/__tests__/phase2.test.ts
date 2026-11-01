// Phase 2 tests: auth / users / permissions / licenses services against a
// real SQLite file, asserting the legacy semantics ported from
// offlineDb.ts + localAdmin.ts (see authService.ts header).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import {
  signIn, getRecoveryQuestion, resetPassword,
  listUsers, createUser, deleteUser, updateUser,
  getPermissions, listAllPermissions,
} from '../services/authService';
import { listLicenses, createLicense, setLicenseActive, deleteLicense } from '../services/licenseService';
import { settingsDtoToLegacy, type SettingsDto } from '../../src/lib/api';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;
let db: Db;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p2-'));
  db = openDatabase(path.join(dir, 'test.db'), MIGRATIONS);
  await seedIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('signIn (legacy hash compatibility)', () => {
  it('seeded admin/admin123 signs in — old salted SHA-256 scheme still valid', async () => {
    const res = await signIn(db, 'admin', 'admin123');
    expect(res.error).toBeUndefined();
    expect(res.user?.username).toBe('admin');
    expect(res.user?.permissions).toEqual([]);
  });
  it('username match is case-insensitive, password is not', async () => {
    expect((await signIn(db, 'ADMIN', 'admin123')).user?.username).toBe('admin');
    expect((await signIn(db, 'admin', 'Admin123')).error).toBe('Invalid username or password');
    expect((await signIn(db, 'admin', 'wrong')).error).toBe('Invalid username or password');
    expect((await signIn(db, 'ghost', 'admin123')).error).toBe('Invalid username or password');
  });
});

describe('user management (localAdmin semantics)', () => {
  it('validates username and password like the old code', async () => {
    expect((await createUser(db, 'ab', 'password1', null)).error).toMatch(/3-30/);
    expect((await createUser(db, 'bad name!', 'password1', null)).error).toMatch(/3-30/);
    expect((await createUser(db, 'good.name-1', '12345', null)).error).toMatch(/at least 6/);
    expect((await createUser(db, 'good.name-1', '123456', null)).error).toBeUndefined();
    expect((await createUser(db, 'GOOD.NAME-1', '123456', null)).error).toBe('This username is already taken');
  });
  it('created user can sign in; restricted permissions come back on the session', async () => {
    await createUser(db, 'clerk', 'clerkpass', ['dashboard', 'customers']);
    const res = await signIn(db, 'clerk', 'clerkpass');
    expect(res.user?.permissions).toEqual(['dashboard', 'customers']);
    const { users } = await listUsers(db);
    expect(users.map((u) => u.username)).toEqual(['admin', 'clerk']);
  });
  it('delete removes the user and their permissions row', async () => {
    await createUser(db, 'temp', 'temppass', ['dashboard']);
    const { users } = await listUsers(db);
    const temp = users.find((u) => u.username === 'temp')!;
    await deleteUser(db, temp.id);
    expect((await signIn(db, 'temp', 'temppass')).error).toBe('Invalid username or password');
    expect(await getPermissions(db, temp.id)).toBeNull();
  });
});

describe('permissions semantics (null row = full access)', () => {
  it('distinguishes no-row, restricted row and empty row', async () => {
    const { users } = await listUsers(db);
    const adminId = users[0].id;
    expect(await getPermissions(db, adminId)).toBeNull(); // seeded admin: no row

    await createUser(db, 'locked', 'lockedpass', []);
    const locked = (await listUsers(db)).users.find((u) => u.username === 'locked')!;
    expect(await getPermissions(db, locked.id)).toEqual([]); // row exists, empty = locked out

    await updateUser(db, { userId: locked.id, username: 'locked', permissions: ['reports'] });
    expect(await getPermissions(db, locked.id)).toEqual(['reports']);

    // update with null OR empty removes the row -> full access again (legacy rule)
    await updateUser(db, { userId: locked.id, username: 'locked', permissions: [] });
    expect(await getPermissions(db, locked.id)).toBeNull();

    const all = await listAllPermissions(db);
    expect(all.find((r) => r.userId === locked.id)).toBeUndefined();
  });
});

describe('password recovery flow', () => {
  it('question + answer (case-insensitive) resets the password', async () => {
    await createUser(db, 'clerk', 'oldpass1', null);
    const clerk = (await listUsers(db)).users.find((u) => u.username === 'clerk')!;
    await updateUser(db, {
      userId: clerk.id, username: 'clerk', permissions: null,
      recoveryQuestion: 'First school?', recoveryAnswer: 'Model School',
    });

    expect((await getRecoveryQuestion(db, 'clerk')).question).toBe('First school?');
    expect((await getRecoveryQuestion(db, 'nobody')).error).toMatch(/Could not find/);
    expect((await resetPassword(db, 'clerk', 'wrong answer', 'newpass1')).error).toBe('Incorrect answer');
    expect((await resetPassword(db, 'clerk', 'model school', 'newpass1')).error).toBeUndefined();

    expect((await signIn(db, 'clerk', 'oldpass1')).error).toBe('Invalid username or password');
    expect((await signIn(db, 'clerk', 'newpass1')).user?.username).toBe('clerk');
  });
});

describe('licenses registry', () => {
  const key = 'DIST-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA';
  it('create/list/toggle/delete with duplicate protection', async () => {
    expect((await createLicense(db, { licenseKey: key, customerName: 'Ali Traders', maxDevices: 1, expiresAt: null })).error).toBeUndefined();
    expect((await createLicense(db, { licenseKey: key, customerName: 'Dupe', maxDevices: 1, expiresAt: null })).error).toBeTruthy();

    let rows = await listLicenses(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].isActive).toBe(true);
    expect(rows[0].customerName).toBe('Ali Traders');

    await setLicenseActive(db, rows[0].id, false);
    rows = await listLicenses(db);
    expect(rows[0].isActive).toBe(false);

    await deleteLicense(db, rows[0].id);
    expect(await listLicenses(db)).toHaveLength(0);
  });
});

describe('settings adapter (renderer contract)', () => {
  it('maps the DTO to the legacy snake_case Settings shape', () => {
    const dto: SettingsDto = {
      id: 'x', companyName: 'Co', companyAddress: null, companyPhone: '1', companyEmail: null,
      currencySymbol: 'Rs', taxRate: 5.5, invoicePrefix: 'INV-', supplierInvoicePrefix: 'SUP-',
      paymentVoucherPrefix: 'PV-', expenseVoucherPrefix: 'EV-', gatePassPrefix: 'GP-',
      salesReturnPrefix: 'SR-', purchaseReturnPrefix: 'PR-', defaultPrintFormat: 'a4',
      thermalPrinterWidth: '80mm', invoiceFooterNote: 'Thanks', createdAt: null,
    };
    const legacy = settingsDtoToLegacy(dto);
    expect(legacy.company_name).toBe('Co');
    expect(legacy.tax_rate).toBe(5.5);
    expect(legacy.invoice_prefix).toBe('INV-');
    expect(legacy.invoice_footer_note).toBe('Thanks');
  });
});
