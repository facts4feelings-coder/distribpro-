// Phase 4 tests: the transaction core. The D6 stock scenarios are the heart
// of this file — they pin the CORRECT behaviour where the old Postgres
// trigger was wrong (edit double-deducted, delete deducted again).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import {
  createCustomer, createSupplier, createProduct, listProducts, listCustomers, listSuppliers,
  type PartyInput, type ProductInput,
} from '../services/masterService';
import {
  createInvoice, updateInvoice, deleteInvoice, getInvoice, listInvoiceItems, countInvoices, customerRates,
  createPaymentVoucher, updatePaymentVoucher, deletePaymentVoucher, listPaymentVouchers,
  createExpenseVoucher, listExpenseVouchers, deleteExpenseVoucher,
  listGatePasses,
  type InvoiceInput, type InvoiceItemInput,
} from '../services/transactionService';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');
let dir: string;
let db: Db;
let custId = '';
let suppId = '';
let prodId = '';

const party = (name: string): PartyInput => ({
  name, phone: null, address: null, city: null, openingBalance: 0, currentBalance: 0,
});
const inv = (over: Partial<InvoiceInput>): InvoiceInput => ({
  invoiceNo: 'INV-0001', partyId: custId, invoiceDate: '2026-10-01', dueDate: null,
  subtotal: 0, discount: 0, tax: 0, total: 0, paidAmount: 0, balance: 0,
  status: 'unpaid', paymentType: 'credit', notes: null, invoiceType: 'sale', ...over,
});
const item = (qty: number, price = 100): InvoiceItemInput => ({
  productId: prodId, productName: 'Cooking Oil', quantity: qty,
  unitPrice: price, discountPercent: 0, total: qty * price,
});
const stock = async () => (await listProducts(db)).find((p) => p.id === prodId)!.stockQuantity;
const custBalance = async () => (await listCustomers(db)).find((c) => c.id === custId)!.currentBalance;
const suppBalance = async () => (await listSuppliers(db)).find((s) => s.id === suppId)!.currentBalance;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'distribpro-p4-'));
  db = openDatabase(path.join(dir, 'test.db'), MIGRATIONS);
  await seedIfEmpty(db);
  await createCustomer(db, party('Bilal Store'));
  await createSupplier(db, party('Oil Supplier'));
  await createProduct(db, {
    name: 'Cooking Oil', sku: null, category: null, unit: 'pcs',
    purchasePrice: 80, salePrice: 100, stockQuantity: 100, reorderLevel: 0,
  } satisfies ProductInput);
  custId = (await listCustomers(db))[0].id;
  suppId = (await listSuppliers(db))[0].id;
  prodId = (await listProducts(db))[0].id;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('stock: the D6 scenarios', () => {
  it('sale create takes stock out; balance + status set', async () => {
    const { invoice } = await createInvoice(db, 'customer',
      inv({ total: 500, balance: 500 }), [item(5)]);
    expect(invoice).toBeTruthy();
    expect(await stock()).toBe(95);
    expect(await custBalance()).toBe(500);
    expect(invoice!.status).toBe('unpaid');
  });

  it('EDIT sale 5 -> 8 deducts only 3 more (old bug deducted 8 again: -18 total)', async () => {
    const { invoice } = await createInvoice(db, 'customer',
      inv({ total: 500, balance: 500 }), [item(5)]);
    await updateInvoice(db, 'customer', invoice!.id,
      inv({ total: 800, balance: 800 }), [item(8)]);
    expect(await stock()).toBe(92); // 100 - 8, NOT 82
    expect(await custBalance()).toBe(800);
    const items = await listInvoiceItems(db, 'customer', invoice!.id);
    expect(items[0].quantity).toBe(8);
  });

  it('DELETE sale restores stock fully (old bug deducted again)', async () => {
    const { invoice } = await createInvoice(db, 'customer',
      inv({ total: 500, balance: 500 }), [item(5)]);
    expect(await stock()).toBe(95);
    await deleteInvoice(db, 'customer', invoice!.id);
    expect(await stock()).toBe(100);
    expect(await custBalance()).toBe(0);
    expect(await getInvoice(db, 'customer', invoice!.id)).toBeNull();
  });

  it('sales return puts stock back and reduces the customer balance', async () => {
    await createInvoice(db, 'customer', inv({ total: 1000, balance: 1000 }), [item(10)]);
    expect(await stock()).toBe(90);
    await createInvoice(db, 'customer',
      inv({ invoiceNo: 'SR-0001', invoiceType: 'sales-return', total: 300, balance: 300 }),
      [item(3)]);
    expect(await stock()).toBe(93);
    expect(await custBalance()).toBe(700); // 1000 sale - 300 return
  });

  it('purchase adds stock, purchase return removes it, supplier balance mirrors', async () => {
    await createInvoice(db, 'supplier',
      inv({ partyId: suppId, invoiceNo: 'PUR-1', invoiceType: 'purchase', total: 4000, balance: 4000 }),
      [item(50, 80)]);
    expect(await stock()).toBe(150);
    expect(await suppBalance()).toBe(4000);
    await createInvoice(db, 'supplier',
      inv({ partyId: suppId, invoiceNo: 'PR-1', invoiceType: 'purchase-return', total: 800, balance: 800 }),
      [item(10, 80)]);
    expect(await stock()).toBe(140);
    expect(await suppBalance()).toBe(3200);
  });

  it('fractional quantities use milli-units exactly', async () => {
    await createInvoice(db, 'customer', inv({ total: 250, balance: 250 }), [item(2.5)]);
    expect(await stock()).toBe(97.5);
  });
});

describe('payment vouchers: FIFO allocation', () => {
  async function twoSales() {
    const a = await createInvoice(db, 'customer',
      inv({ invoiceNo: 'INV-0001', invoiceDate: '2026-10-01', total: 1000, balance: 1000 }), [item(10)]);
    const b = await createInvoice(db, 'customer',
      inv({ invoiceNo: 'INV-0002', invoiceDate: '2026-10-02', total: 2000, balance: 2000 }), [item(20)]);
    return { a: a.invoice!, b: b.invoice! };
  }

  it('applies to the oldest open invoice first', async () => {
    const { a, b } = await twoSales();
    await createPaymentVoucher(db, {
      voucherNo: 'PV-0001', customerId: custId, supplierId: null,
      voucherDate: '2026-10-03', amount: 1500, paymentMethod: 'cash', reference: null, notes: null,
    });
    const ia = await getInvoice(db, 'customer', a.id);
    const ib = await getInvoice(db, 'customer', b.id);
    expect(ia).toMatchObject({ paidAmount: 1000, balance: 0, status: 'paid' });
    expect(ib).toMatchObject({ paidAmount: 500, balance: 1500, status: 'unpaid' });
    expect(await custBalance()).toBe(1500);
  });

  it('edit reverses the old allocation then applies the new one', async () => {
    const { a, b } = await twoSales();
    await createPaymentVoucher(db, {
      voucherNo: 'PV-0001', customerId: custId, supplierId: null,
      voucherDate: '2026-10-03', amount: 1500, paymentMethod: 'cash', reference: null, notes: null,
    });
    const v = (await listPaymentVouchers(db))[0];
    await updatePaymentVoucher(db, v.id, {
      voucherNo: 'PV-0001', customerId: custId, supplierId: null,
      voucherDate: '2026-10-03', amount: 1000, paymentMethod: 'cash', reference: null, notes: null,
    });
    expect(await getInvoice(db, 'customer', a.id)).toMatchObject({ paidAmount: 1000, balance: 0, status: 'paid' });
    expect(await getInvoice(db, 'customer', b.id)).toMatchObject({ paidAmount: 0, balance: 2000 });
    expect(await custBalance()).toBe(2000);
  });

  it('delete reverses everything', async () => {
    const { a, b } = await twoSales();
    await createPaymentVoucher(db, {
      voucherNo: 'PV-0001', customerId: custId, supplierId: null,
      voucherDate: '2026-10-03', amount: 1500, paymentMethod: 'cash', reference: null, notes: null,
    });
    const v = (await listPaymentVouchers(db))[0];
    await deletePaymentVoucher(db, v.id);
    expect(await getInvoice(db, 'customer', a.id)).toMatchObject({ paidAmount: 0, balance: 1000, status: 'unpaid' });
    expect(await getInvoice(db, 'customer', b.id)).toMatchObject({ paidAmount: 0, balance: 2000 });
    expect(await custBalance()).toBe(3000);
  });

  it('supplier vouchers pay purchases the same way', async () => {
    const p = await createInvoice(db, 'supplier',
      inv({ partyId: suppId, invoiceNo: 'PUR-1', invoiceType: 'purchase', total: 4000, balance: 4000 }),
      [item(50, 80)]);
    await createPaymentVoucher(db, {
      voucherNo: 'PV-0002', customerId: null, supplierId: suppId,
      voucherDate: '2026-10-03', amount: 4000, paymentMethod: 'bank', reference: null, notes: null,
    });
    expect(await getInvoice(db, 'supplier', p.invoice!.id)).toMatchObject({ paidAmount: 4000, balance: 0, status: 'paid' });
    expect(await suppBalance()).toBe(0);
  });
});

describe('extras', () => {
  it('gate pass is auto-created with a sale when requested', async () => {
    await createInvoice(db, 'customer', inv({ total: 500, balance: 500 }), [item(5)], { withGatePass: true });
    const passes = await listGatePasses(db);
    expect(passes).toHaveLength(1);
    expect(passes[0].passNo).toBe('GP-0001');
    expect(passes[0].itemsDescription).toContain('Cooking Oil');
    expect(passes[0].totalAmount).toBe(500);
  });

  it('customer rates remember the last price per product', async () => {
    await createInvoice(db, 'customer', inv({ total: 500, balance: 500 }), [item(5, 100)]);
    await createInvoice(db, 'customer', inv({ invoiceNo: 'INV-0002', total: 550, balance: 550 }), [item(5, 110)]);
    const rates = await customerRates(db, custId);
    expect(rates[prodId]).toBe(110);
  });

  it('expense vouchers CRUD + invoice counting', async () => {
    await createExpenseVoucher(db, {
      voucherNo: 'EXP-0001', expenseDate: '2026-10-01', category: 'Fuel',
      description: null, amount: 2500, paidTo: null,
    });
    expect(await listExpenseVouchers(db)).toHaveLength(1);
    const v = (await listExpenseVouchers(db))[0];
    await deleteExpenseVoucher(db, v.id);
    expect(await listExpenseVouchers(db)).toHaveLength(0);

    await createInvoice(db, 'customer', inv({ total: 100, balance: 100 }), [item(1)]);
    expect(await countInvoices(db, 'customer', 'sale')).toBe(1);
    expect(await countInvoices(db, 'customer', 'sales-return')).toBe(0);
  });
});
