// Phase 3 tests: master-data services against a real SQLite file — CRUD,
// unit conversions at the boundary (raw DB values checked), ordering, the
// delete rules from the schema FKs, and route assignment toggling.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import { customers as customersT, products as productsT, customerInvoices } from '../db/schema';
import {
  listCustomers, createCustomer, bulkCreateCustomers, updateCustomer, deleteCustomer,
  createSupplier, deleteSupplier,
  listProducts, createProduct, bulkCreateProducts, deleteProduct,
  listRoutes, createRoute, deleteRoute, listCustomerRoutes, assignCustomerRoute, unassignCustomerRoute,
  listEmployees, createEmployee, deleteEmployee,
  listSalaryPayments, createSalaryPayment, deleteSalaryPayment,
  listIncome, createIncome, updateIncome, deleteIncome,
  type PartyInput, type ProductInput,
} from '../services/masterService';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;
let db: Db;

const party = (name: string, opening = 0): PartyInput => ({
  name, phone: null, address: null, city: null,
  openingBalance: opening, currentBalance: opening,
});
const product = (name: string): ProductInput => ({
  name, sku: null, category: null, unit: 'pcs',
  purchasePrice: 400, salePrice: 500, stockQuantity: 0, reorderLevel: 0,
});

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p3-'));
  db = openDatabase(path.join(dir, 'test.db'), MIGRATIONS);
  await seedIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('customers', () => {
  it('CRUD with paisa conversion at the boundary', async () => {
    await createCustomer(db, party('Bilal Store', 150.5));
    await createCustomer(db, party('Ahmed Traders', 0));

    const raw = await db.select().from(customersT);
    expect(raw.find((r) => r.name === 'Bilal Store')?.openingBalance).toBe(15050); // stored paisa

    const list = await listCustomers(db);
    expect(list.map((c) => c.name)).toEqual(['Ahmed Traders', 'Bilal Store']); // order by name
    expect(list.find((c) => c.name === 'Bilal Store')?.openingBalance).toBe(150.5); // back to rupees

    const ahmed = list.find((c) => c.name === 'Ahmed Traders')!;
    await updateCustomer(db, ahmed.id, { ...party('Ahmed Traders', 200), city: 'Lahore' });
    const after = await listCustomers(db);
    expect(after.find((c) => c.id === ahmed.id)?.currentBalance).toBe(200);
    expect(after.find((c) => c.id === ahmed.id)?.city).toBe('Lahore');

    const bilal = list.find((c) => c.name === 'Bilal Store')!;
    expect((await deleteCustomer(db, bilal.id)).error).toBeUndefined();
    expect(await listCustomers(db)).toHaveLength(1);
  });

  it('bulk create (CSV import path) inserts all rows', async () => {
    const res = await bulkCreateCustomers(db, [party('One'), party('Two'), party('Three')]);
    expect(res).toEqual({ count: 3 });
    expect(await listCustomers(db)).toHaveLength(3);
  });

  it('a customer with invoices cannot be deleted (FK RESTRICT -> friendly error)', async () => {
    await createCustomer(db, party('Has Invoices'));
    const c = (await listCustomers(db))[0];
    await db.insert(customerInvoices).values({ invoiceNo: 'INV-0001', customerId: c.id });
    const res = await deleteCustomer(db, c.id);
    expect(res.error).toMatch(/cannot be deleted/);
    expect(await listCustomers(db)).toHaveLength(1);
  });

  it('supplier delete is protected the same way only when referenced', async () => {
    await createSupplier(db, party('Free Supplier'));
    const { listSuppliers } = await import('../services/masterService');
    const s = (await listSuppliers(db))[0];
    expect((await deleteSupplier(db, s.id)).error).toBeUndefined();
  });
});

describe('products', () => {
  it('stores prices as paisa and quantities as milli-units', async () => {
    await createProduct(db, { ...product('Cooking Oil 1L'), stockQuantity: 2.5, reorderLevel: 0.25 });
    const raw = await db.select().from(productsT);
    expect(raw[0].purchasePrice).toBe(40000);
    expect(raw[0].stockQuantity).toBe(2500);
    expect(raw[0].reorderLevel).toBe(250);

    const list = await listProducts(db);
    expect(list[0].stockQuantity).toBe(2.5);
    expect(list[0].salePrice).toBe(500);

    const bulk = await bulkCreateProducts(db, [product('Rice'), product('Sugar')]);
    expect(bulk.count).toBe(2);
    expect(await listProducts(db)).toHaveLength(3);

    expect((await deleteProduct(db, list[0].id)).error).toBeUndefined();
    expect(await listProducts(db)).toHaveLength(2);
  });
});

describe('routes + assignments', () => {
  it('toggle assign/unassign and cascade on route delete', async () => {
    await createRoute(db, { name: 'Monday Route', description: null, dayOfWeek: 1, sortOrder: 2 });
    await createRoute(db, { name: 'Wednesday Route', description: null, dayOfWeek: 3, sortOrder: 1 });
    await createCustomer(db, party('Shop A'));
    const routes = await listRoutes(db);
    expect(routes.map((r) => r.name)).toEqual(['Wednesday Route', 'Monday Route']); // sort_order

    const cust = (await listCustomers(db))[0];
    await assignCustomerRoute(db, routes[0].id, cust.id);
    let assignments = await listCustomerRoutes(db);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].customerId).toBe(cust.id);

    await unassignCustomerRoute(db, assignments[0].id);
    expect(await listCustomerRoutes(db)).toHaveLength(0);

    await assignCustomerRoute(db, routes[0].id, cust.id);
    await deleteRoute(db, routes[0].id);
    expect(await listCustomerRoutes(db)).toHaveLength(0); // cascade
  });
});

describe('employees + salary payments', () => {
  it('payments list embeds the employee; employee delete cascades payments', async () => {
    await createEmployee(db, {
      name: 'Muhammad Saleem', phone: null, address: null, position: 'Salesman',
      salary: 35000, hireDate: '2026-01-01',
    });
    const emp = (await listEmployees(db))[0];
    expect(emp.salary).toBe(35000);

    await createSalaryPayment(db, {
      employeeId: emp.id, paymentDate: '2026-10-31', amount: 30000,
      month: '2026-10', paymentMethod: 'cash', notes: null,
    });
    const payments = await listSalaryPayments(db);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(30000);
    expect(payments[0].employee?.name).toBe('Muhammad Saleem');

    await deleteSalaryPayment(db, payments[0].id);
    expect(await listSalaryPayments(db)).toHaveLength(0);

    await createSalaryPayment(db, {
      employeeId: emp.id, paymentDate: '2026-10-31', amount: 35000,
      month: '2026-10', paymentMethod: 'cash', notes: null,
    });
    await deleteEmployee(db, emp.id);
    expect(await listSalaryPayments(db)).toHaveLength(0); // cascade
  });
});

describe('other income', () => {
  it('CRUD ordered by date descending', async () => {
    await createIncome(db, { description: 'Scrap sale', amount: 2000, incomeDate: '2026-10-10', category: 'Other', reference: null });
    await createIncome(db, { description: 'Commission', amount: 5000.5, incomeDate: '2026-10-12', category: 'Commission', reference: null });
    let list = await listIncome(db);
    expect(list.map((i) => i.description)).toEqual(['Commission', 'Scrap sale']);
    expect(list[0].amount).toBe(5000.5);

    await updateIncome(db, list[1].id, { description: 'Scrap sale (updated)', amount: 2500, incomeDate: '2026-10-10', category: 'Other', reference: 'R-1' });
    list = await listIncome(db);
    expect(list.find((i) => i.reference === 'R-1')?.amount).toBe(2500);

    await deleteIncome(db, list[0].id);
    expect(await listIncome(db)).toHaveLength(1);
  });
});
