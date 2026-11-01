// Phase 5 tests: dashboard aggregates + salesman targets.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import {
  createCustomer, createSupplier, createProduct, createRoute, listCustomers, listSuppliers, listProducts,
} from '../services/masterService';
import { createInvoice, createPaymentVoucher, createGatePass } from '../services/transactionService';
import {
  dashboardStats, printDataset, reportsDataset,
  listSalesmanTargets, createSalesmanTarget, updateSalesmanTarget, deleteSalesmanTarget,
} from '../services/reportsService';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;
let db: Db;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p5-'));
  db = openDatabase(path.join(dir, 'test.db'), MIGRATIONS);
  await seedIfEmpty(db);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('dashboardStats', () => {
  it('matches the old page semantics (unpaid sums, today filters, low stock)', async () => {
    await createCustomer(db, { name: 'C1', phone: null, address: null, city: null, openingBalance: 0, currentBalance: 0 });
    await createSupplier(db, { name: 'S1', phone: null, address: null, city: null, openingBalance: 0, currentBalance: 0 });
    await createProduct(db, { name: 'Oil', sku: null, category: null, unit: 'pcs', purchasePrice: 80, salePrice: 100, stockQuantity: 100, reorderLevel: 0 });
    await createProduct(db, { name: 'Rice', sku: null, category: null, unit: 'kg', purchasePrice: 150, salePrice: 200, stockQuantity: 2, reorderLevel: 5 });
    const cust = (await listCustomers(db))[0];
    const supp = (await listSuppliers(db))[0];
    const oil = (await listProducts(db)).find((p) => p.name === 'Oil')!;

    await createInvoice(db, 'customer', {
      invoiceNo: 'INV-1', partyId: cust.id, invoiceDate: '2026-10-01', dueDate: null,
      subtotal: 1000, discount: 0, tax: 0, total: 1000, paidAmount: 0, balance: 1000,
      status: 'unpaid', paymentType: 'credit', notes: null, invoiceType: 'sale',
    }, [{ productId: oil.id, productName: 'Oil', quantity: 10, unitPrice: 100, discountPercent: 0, total: 1000 }]);
    await createInvoice(db, 'supplier', {
      invoiceNo: 'PUR-1', partyId: supp.id, invoiceDate: '2026-10-01', dueDate: null,
      subtotal: 4000, discount: 0, tax: 0, total: 4000, paidAmount: 0, balance: 4000,
      status: 'unpaid', notes: null, invoiceType: 'purchase',
    }, []);
    await createPaymentVoucher(db, {
      voucherNo: 'PV-1', customerId: cust.id, supplierId: null,
      voucherDate: '2026-10-05', amount: 700, paymentMethod: 'cash', reference: null, notes: null,
    });
    await createGatePass(db, {
      passNo: 'GP-1', passType: 'sales', customerId: cust.id, customerName: 'C1',
      passDate: '2026-10-05', referenceInvoice: null, itemsDescription: null,
      totalAmount: 0, vehicleNo: null, driverName: null, notes: null,
    });

    const stats = await dashboardStats(db, '2026-10-05');
    expect(stats).toEqual({
      customers: 1, suppliers: 1, products: 2,
      pendingInvoices: 1, receivable: 300, payable: 4000,
      todayPayments: 700, lowStock: 1, gatePasses: 1,
    });
  });

  it('print dataset + reports dataset return the migrated rows', async () => {
    await createCustomer(db, { name: 'C1', phone: null, address: null, city: null, openingBalance: 0, currentBalance: 0 });
    const cust = (await listCustomers(db))[0];
    await createInvoice(db, 'customer', {
      invoiceNo: 'INV-1', partyId: cust.id, invoiceDate: '2026-10-01', dueDate: null,
      subtotal: 100, discount: 0, tax: 0, total: 100, paidAmount: 100, balance: 0,
      status: 'paid', paymentType: 'cash', notes: null, invoiceType: 'sale',
    }, []);
    const pd = await printDataset(db);
    expect(pd.sales).toHaveLength(1);
    expect(pd.sales[0].party?.name).toBe('C1');
    const ds = await reportsDataset(db);
    expect(ds.customerInvoices).toHaveLength(1);
    expect(ds.customers).toHaveLength(1);
  });
});

describe('salesman targets', () => {
  it('CRUD with route name embed and month filter', async () => {
    await createRoute(db, { name: 'Route A', description: null, dayOfWeek: 1, sortOrder: 0 });
    const routes = await (await import('../services/masterService')).listRoutes(db);
    await createSalesmanTarget(db, { routeId: routes[0].id, salesmanName: 'Ahmed', targetMonth: '2026-10', targetAmount: 500000 });
    await createSalesmanTarget(db, { routeId: null, salesmanName: 'Bilal', targetMonth: '2026-11', targetAmount: 1000 });
    const oct = await listSalesmanTargets(db, '2026-10');
    expect(oct).toHaveLength(1);
    expect(oct[0]).toMatchObject({ salesmanName: 'Ahmed', targetAmount: 500000, routeName: 'Route A' });
    await updateSalesmanTarget(db, oct[0].id, { routeId: routes[0].id, salesmanName: 'Ahmed', targetMonth: '2026-10', targetAmount: 600000 });
    expect((await listSalesmanTargets(db, '2026-10'))[0].targetAmount).toBe(600000);
    await deleteSalesmanTarget(db, oct[0].id);
    expect(await listSalesmanTargets(db, '2026-10')).toHaveLength(0);
  });
});
