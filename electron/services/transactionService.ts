// Transaction services (Phase 4): customer/supplier invoices + items,
// returns (same tables, invoice_type), payment vouchers with FIFO allocation,
// expense vouchers, gate passes.
//
// This is where the old Postgres triggers used to live — reimplemented
// CORRECTLY (DECISIONS D6/D7):
//  • Stock: every item change applies delta = -(new signed qty) + (old signed
//    qty), signed by direction: sale −, sales-return +, purchase +,
//    purchase-return −. The old trigger got DELETE/UPDATE wrong (stock
//    dropped twice on edit, dropped further on delete); here edits reverse
//    the old items exactly and deletes restore stock.
//  • Party balances: current_balance = Σ sale balances − Σ return balances
//    (the old recalcCustomerBalance/recalcSupplierBalance logic), recomputed
//    inside the same transaction as the change itself.
//  • Invoice status: balance <= 0 → 'paid' else 'unpaid' (no 'partial').
// All multi-step operations run in ONE SQLite transaction — the old app did
// them as separate calls that could half-apply.
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';

/** Millisecond timestamps so same-second rows still order correctly. */
const nowIso = () => new Date().toISOString();
import type { Db } from '../db/client';
import {
  customers, suppliers, products, settings as settingsT,
  customerInvoices, customerInvoiceItems, supplierInvoices, supplierInvoiceItems,
  paymentVouchers, expenseVouchers, gatePasses,
} from '../db/schema';
import { toPaisa, fromPaisa, toMilliQty, fromMilliQty, toPercentX100, fromPercentX100 } from '../lib/units';
import type { PartyDto } from './masterService';

export type PartyKind = 'customer' | 'supplier';

// ------------------------------------------------------------------ DTOs
export interface InvoiceItemDto {
  id: string;
  invoiceId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
  createdAt: string | null;
}
export interface InvoiceItemInput {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}
export interface InvoiceDto {
  id: string;
  invoiceNo: string;
  partyId: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  paymentType: string | null;
  notes: string | null;
  invoiceType: string;
  createdAt: string | null;
  party: PartyDto | null;
}
export interface InvoiceInput {
  invoiceNo: string;
  partyId: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  paymentType?: string | null;
  notes: string | null;
  invoiceType: string;
}

type CustInvRow = typeof customerInvoices.$inferSelect;
type SuppInvRow = typeof supplierInvoices.$inferSelect;
type CustItemRow = typeof customerInvoiceItems.$inferSelect;
type SuppItemRow = typeof supplierInvoiceItems.$inferSelect;
type PartyRow = typeof customers.$inferSelect;

const partyToDto = (r: PartyRow): PartyDto => ({
  id: r.id, name: r.name, phone: r.phone, address: r.address, city: r.city,
  openingBalance: fromPaisa(r.openingBalance), currentBalance: fromPaisa(r.currentBalance),
  balanceType: r.balanceType, createdAt: r.createdAt,
});

const custInvToDto = (r: CustInvRow, party: PartyDto | null): InvoiceDto => ({
  id: r.id, invoiceNo: r.invoiceNo, partyId: r.customerId, invoiceDate: r.invoiceDate,
  dueDate: r.dueDate, subtotal: fromPaisa(r.subtotal), discount: fromPaisa(r.discount),
  tax: fromPaisa(r.tax), total: fromPaisa(r.total), paidAmount: fromPaisa(r.paidAmount),
  balance: fromPaisa(r.balance), status: r.status, paymentType: r.paymentType,
  notes: r.notes, invoiceType: r.invoiceType, createdAt: r.createdAt, party,
});
const suppInvToDto = (r: SuppInvRow, party: PartyDto | null): InvoiceDto => ({
  id: r.id, invoiceNo: r.invoiceNo, partyId: r.supplierId, invoiceDate: r.invoiceDate,
  dueDate: r.dueDate, subtotal: fromPaisa(r.subtotal), discount: fromPaisa(r.discount),
  tax: fromPaisa(r.tax), total: fromPaisa(r.total), paidAmount: fromPaisa(r.paidAmount),
  balance: fromPaisa(r.balance), status: r.status, paymentType: null,
  notes: r.notes, invoiceType: r.invoiceType, createdAt: r.createdAt, party,
});
const itemToDto = (r: CustItemRow | SuppItemRow): InvoiceItemDto => ({
  id: r.id, invoiceId: r.invoiceId, productId: r.productId, productName: r.productName,
  quantity: fromMilliQty(r.quantity), unitPrice: fromPaisa(r.unitPrice),
  discountPercent: fromPercentX100(r.discountPercent), total: fromPaisa(r.total),
  createdAt: r.createdAt,
});

// ------------------------------------------------------------- stock core
/** Sign of an item's stock effect: +1 means the item ADDS stock. */
function stockSign(kind: PartyKind, invoiceType: string): 1 | -1 {
  if (kind === 'customer') return invoiceType === 'sales-return' ? 1 : -1; // sale takes stock out
  return invoiceType === 'purchase-return' ? -1 : 1; // purchase brings stock in
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function applyStockDelta(tx: Tx, productId: string, deltaMilli: number) {
  if (deltaMilli === 0) return;
  tx.update(products)
    .set({ stockQuantity: sql`${products.stockQuantity} + ${deltaMilli}` })
    .where(eq(products.id, productId))
    .run();
}

/** Apply (direction=+1) or reverse (direction=-1) a set of items' stock effect. */
function applyItemsStock(
  tx: Tx, kind: PartyKind, invoiceType: string,
  items: { productId: string | null; quantity: number }[],
  direction: 1 | -1,
) {
  const sign = stockSign(kind, invoiceType) * direction;
  for (const it of items) {
    if (!it.productId) continue;
    applyStockDelta(tx, it.productId, sign * toMilliQty(it.quantity));
  }
}

// ------------------------------------------------------------- balances
function recalcPartyBalance(tx: Tx, kind: PartyKind, partyId: string) {
  if (kind === 'customer') {
    const rows = tx
      .select({ t: customerInvoices.invoiceType, b: customerInvoices.balance })
      .from(customerInvoices)
      .where(eq(customerInvoices.customerId, partyId))
      .all();
    let bal = 0;
    for (const r of rows) {
      if (r.t === 'sale') bal += r.b;
      else if (r.t === 'sales-return') bal -= r.b;
    }
    tx.update(customers).set({ currentBalance: bal }).where(eq(customers.id, partyId)).run();
  } else {
    const rows = tx
      .select({ t: supplierInvoices.invoiceType, b: supplierInvoices.balance })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.supplierId, partyId))
      .all();
    let bal = 0;
    for (const r of rows) {
      if (r.t === 'purchase') bal += r.b;
      else if (r.t === 'purchase-return') bal -= r.b;
    }
    tx.update(suppliers).set({ currentBalance: bal }).where(eq(suppliers.id, partyId)).run();
  }
}

// ------------------------------------------------------------- invoices
const invValues = (i: InvoiceInput) => ({
  invoiceNo: i.invoiceNo, invoiceDate: i.invoiceDate, dueDate: i.dueDate,
  subtotal: toPaisa(i.subtotal), discount: toPaisa(i.discount), tax: toPaisa(i.tax),
  total: toPaisa(i.total), paidAmount: toPaisa(i.paidAmount), balance: toPaisa(i.balance),
  status: i.status, notes: i.notes, invoiceType: i.invoiceType,
});
const itemValues = (invoiceId: string, i: InvoiceItemInput) => ({ createdAt: nowIso(),
  invoiceId, productId: i.productId, productName: i.productName,
  quantity: toMilliQty(i.quantity), unitPrice: toPaisa(i.unitPrice),
  discountPercent: toPercentX100(i.discountPercent), total: toPaisa(i.total),
});

export async function listInvoices(db: Db, kind: PartyKind, invoiceType: string): Promise<InvoiceDto[]> {
  if (kind === 'customer') {
    const rows = await db
      .select({ inv: customerInvoices, party: customers })
      .from(customerInvoices)
      .leftJoin(customers, eq(customerInvoices.customerId, customers.id))
      .where(eq(customerInvoices.invoiceType, invoiceType))
      .orderBy(desc(customerInvoices.createdAt));
    return rows.map(({ inv, party }) => custInvToDto(inv, party ? partyToDto(party) : null));
  }
  const rows = await db
    .select({ inv: supplierInvoices, party: suppliers })
    .from(supplierInvoices)
    .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
    .where(eq(supplierInvoices.invoiceType, invoiceType))
    .orderBy(desc(supplierInvoices.createdAt));
  return rows.map(({ inv, party }) => suppInvToDto(inv, party ? partyToDto(party) : null));
}

export async function listInvoicesForParty(db: Db, kind: PartyKind, partyId: string): Promise<InvoiceDto[]> {
  if (kind === 'customer') {
    const rows = await db.select().from(customerInvoices)
      .where(eq(customerInvoices.customerId, partyId))
      .orderBy(asc(customerInvoices.invoiceDate));
    return rows.map((r) => custInvToDto(r, null));
  }
  const rows = await db.select().from(supplierInvoices)
    .where(eq(supplierInvoices.supplierId, partyId))
    .orderBy(asc(supplierInvoices.invoiceDate));
  return rows.map((r) => suppInvToDto(r, null));
}

export async function listInvoicesByDate(db: Db, kind: PartyKind, date: string): Promise<InvoiceDto[]> {
  if (kind === 'customer') {
    const rows = await db.select().from(customerInvoices)
      .where(eq(customerInvoices.invoiceDate, date))
      .orderBy(asc(customerInvoices.invoiceNo));
    return rows.map((r) => custInvToDto(r, null));
  }
  const rows = await db.select().from(supplierInvoices)
    .where(eq(supplierInvoices.invoiceDate, date))
    .orderBy(asc(supplierInvoices.invoiceNo));
  return rows.map((r) => suppInvToDto(r, null));
}

export async function getInvoice(db: Db, kind: PartyKind, id: string): Promise<InvoiceDto | null> {
  if (kind === 'customer') {
    const [row] = await db.select().from(customerInvoices).where(eq(customerInvoices.id, id));
    return row ? custInvToDto(row, null) : null;
  }
  const [row] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id));
  return row ? suppInvToDto(row, null) : null;
}

export async function listInvoiceItems(db: Db, kind: PartyKind, invoiceId: string): Promise<InvoiceItemDto[]> {
  const table = kind === 'customer' ? customerInvoiceItems : supplierInvoiceItems;
  const rows = await db.select().from(table).where(eq(table.invoiceId, invoiceId));
  return rows.map(itemToDto);
}

export async function countInvoices(db: Db, kind: PartyKind, invoiceType: string): Promise<number> {
  const table = kind === 'customer' ? customerInvoices : supplierInvoices;
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.invoiceType, invoiceType));
  return rows.length;
}

function createGatePassFor(
  tx: Tx, inv: { invoiceNo: string; invoiceDate: string; total: number; partyId: string },
  items: InvoiceItemInput[],
) {
  const s = tx.select().from(settingsT).limit(1).get();
  const prefix = s?.gatePassPrefix ?? 'GP-';
  const existing = tx.select({ id: gatePasses.id }).from(gatePasses).all();
  const cust = tx.select().from(customers).where(eq(customers.id, inv.partyId)).get();
  tx.insert(gatePasses).values({
    passNo: `${prefix}${String(existing.length + 1).padStart(4, '0')}`,
    passType: 'sales',
    customerId: inv.partyId,
    customerName: cust?.name ?? '',
    createdAt: nowIso(),
    passDate: inv.invoiceDate,
    referenceInvoice: inv.invoiceNo,
    itemsDescription: items.map((i) => `${i.productName} x ${i.quantity}`).join(', ') || null,
    totalAmount: toPaisa(inv.total),
  }).run();
}

export async function createInvoice(
  db: Db, kind: PartyKind, input: InvoiceInput, items: InvoiceItemInput[],
  opts?: { withGatePass?: boolean },
): Promise<{ error?: string; invoice?: InvoiceDto }> {
  let createdId = '';
  db.transaction((tx) => {
    if (kind === 'customer') {
      const [row] = tx.insert(customerInvoices)
        .values({ ...invValues(input), customerId: input.partyId, paymentType: input.paymentType ?? 'credit', createdAt: nowIso() })
        .returning()
        .all();
      createdId = row.id;
      if (items.length > 0) tx.insert(customerInvoiceItems).values(items.map((i) => itemValues(createdId, i))).run();
    } else {
      const [row] = tx.insert(supplierInvoices)
        .values({ ...invValues(input), supplierId: input.partyId, createdAt: nowIso() })
        .returning()
        .all();
      createdId = row.id;
      if (items.length > 0) tx.insert(supplierInvoiceItems).values(items.map((i) => itemValues(createdId, i))).run();
    }
    applyItemsStock(tx, kind, input.invoiceType, items, 1);
    if (opts?.withGatePass && kind === 'customer') {
      createGatePassFor(tx, { invoiceNo: input.invoiceNo, invoiceDate: input.invoiceDate, total: input.total, partyId: input.partyId }, items);
    }
    recalcPartyBalance(tx, kind, input.partyId);
  });
  const invoice = await getInvoice(db, kind, createdId);
  return { invoice: invoice ?? undefined };
}

export async function updateInvoice(
  db: Db, kind: PartyKind, id: string, input: InvoiceInput, items: InvoiceItemInput[],
): Promise<{ error?: string }> {
  db.transaction((tx) => {
    const invTable = kind === 'customer' ? customerInvoices : supplierInvoices;
    const itemTable = kind === 'customer' ? customerInvoiceItems : supplierInvoiceItems;
    const old = tx.select().from(invTable).where(eq(invTable.id, id)).get();
    if (!old) return;
    const oldItems = tx.select().from(itemTable).where(eq(itemTable.invoiceId, id)).all();
    const oldPartyId = kind === 'customer'
      ? (old as CustInvRow).customerId
      : (old as SuppInvRow).supplierId;
    // 1) Reverse the old items' stock effect exactly (the D6 fix).
    applyItemsStock(tx, kind, old.invoiceType,
      oldItems.map((i) => ({ productId: i.productId, quantity: fromMilliQty(i.quantity) })), -1);
    // 2) Replace the invoice + items.
    if (kind === 'customer') {
      tx.update(customerInvoices)
        .set({ ...invValues(input), customerId: input.partyId, paymentType: input.paymentType ?? 'credit' })
        .where(eq(customerInvoices.id, id))
        .run();
    } else {
      tx.update(supplierInvoices)
        .set({ ...invValues(input), supplierId: input.partyId })
        .where(eq(supplierInvoices.id, id))
        .run();
    }
    tx.delete(itemTable).where(eq(itemTable.invoiceId, id)).run();
    if (items.length > 0) tx.insert(itemTable).values(items.map((i) => itemValues(id, i))).run();
    // 3) Apply the new items' stock effect.
    applyItemsStock(tx, kind, input.invoiceType, items, 1);
    // 4) Balances for both parties if the invoice changed hands.
    recalcPartyBalance(tx, kind, oldPartyId);
    if (input.partyId !== oldPartyId) recalcPartyBalance(tx, kind, input.partyId);
  });
  return {};
}

export async function deleteInvoice(db: Db, kind: PartyKind, id: string): Promise<{ error?: string }> {
  db.transaction((tx) => {
    const invTable = kind === 'customer' ? customerInvoices : supplierInvoices;
    const itemTable = kind === 'customer' ? customerInvoiceItems : supplierInvoiceItems;
    const old = tx.select().from(invTable).where(eq(invTable.id, id)).get();
    if (!old) return;
    const oldItems = tx.select().from(itemTable).where(eq(itemTable.invoiceId, id)).all();
    // Deleting restores stock (old trigger did the opposite — D6).
    applyItemsStock(tx, kind, old.invoiceType,
      oldItems.map((i) => ({ productId: i.productId, quantity: fromMilliQty(i.quantity) })), -1);
    tx.delete(invTable).where(eq(invTable.id, id)).run(); // items cascade
    const partyId = kind === 'customer' ? (old as CustInvRow).customerId : (old as SuppInvRow).supplierId;
    recalcPartyBalance(tx, kind, partyId);
  });
  return {};
}

/** Last price this customer paid per product (for rate memory in sale forms). */
export async function customerRates(db: Db, customerId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ item: customerInvoiceItems })
    .from(customerInvoiceItems)
    .innerJoin(customerInvoices, eq(customerInvoiceItems.invoiceId, customerInvoices.id))
    .where(eq(customerInvoices.customerId, customerId))
    .orderBy(desc(customerInvoiceItems.createdAt));
  const rates: Record<string, number> = {};
  for (const { item } of rows) {
    if (item.productId && !(item.productId in rates)) {
      rates[item.productId] = fromPaisa(item.unitPrice);
    }
  }
  return rates;
}

// ------------------------------------------------------- payment vouchers
export interface PaymentVoucherDto {
  id: string;
  voucherNo: string;
  customerId: string | null;
  supplierId: string | null;
  voucherDate: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  createdAt: string | null;
  customer: PartyDto | null;
  supplier: PartyDto | null;
}
export interface PaymentVoucherInput {
  voucherNo: string;
  customerId: string | null;
  supplierId: string | null;
  voucherDate: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

type VoucherRow = typeof paymentVouchers.$inferSelect;
const voucherToDto = (r: VoucherRow, cust: PartyDto | null, supp: PartyDto | null): PaymentVoucherDto => ({
  id: r.id, voucherNo: r.voucherNo, customerId: r.customerId, supplierId: r.supplierId,
  voucherDate: r.voucherDate, amount: fromPaisa(r.amount), paymentMethod: r.paymentMethod,
  reference: r.reference, notes: r.notes, createdAt: r.createdAt, customer: cust, supplier: supp,
});

export async function listPaymentVouchers(db: Db): Promise<PaymentVoucherDto[]> {
  const rows = await db
    .select({ v: paymentVouchers, cust: customers, supp: suppliers })
    .from(paymentVouchers)
    .leftJoin(customers, eq(paymentVouchers.customerId, customers.id))
    .leftJoin(suppliers, eq(paymentVouchers.supplierId, suppliers.id))
    .orderBy(desc(paymentVouchers.createdAt));
  return rows.map(({ v, cust, supp }) => voucherToDto(v, cust ? partyToDto(cust) : null, supp ? partyToDto(supp) : null));
}

export async function listVouchersForParty(db: Db, kind: PartyKind, partyId: string): Promise<PaymentVoucherDto[]> {
  const col = kind === 'customer' ? paymentVouchers.customerId : paymentVouchers.supplierId;
  const rows = await db.select().from(paymentVouchers).where(eq(col, partyId)).orderBy(asc(paymentVouchers.voucherDate));
  return rows.map((r) => voucherToDto(r, null, null));
}

/** FIFO: pay oldest open invoices first; reverse takes from newest paid first. */
function allocatePayment(
  tx: Tx, kind: PartyKind, partyId: string, amountPaisa: number, mode: 'apply' | 'reverse',
) {
  if (amountPaisa <= 0) return;
  const invTable = kind === 'customer' ? customerInvoices : supplierInvoices;
  const partyCol = kind === 'customer' ? customerInvoices.customerId : supplierInvoices.supplierId;
  const mainType = kind === 'customer' ? 'sale' : 'purchase';
  let remaining = amountPaisa;
  if (mode === 'apply') {
    const open = tx.select().from(invTable)
      .where(and(eq(partyCol, partyId), eq(invTable.invoiceType, mainType), gt(invTable.balance, 0)))
      .orderBy(asc(invTable.invoiceDate), asc(invTable.createdAt))
      .all();
    for (const inv of open) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, inv.balance);
      const newBalance = inv.balance - applied;
      tx.update(invTable)
        .set({ paidAmount: inv.paidAmount + applied, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .where(eq(invTable.id, inv.id))
        .run();
      remaining -= applied;
    }
  } else {
    const paid = tx.select().from(invTable)
      .where(and(eq(partyCol, partyId), eq(invTable.invoiceType, mainType), gt(invTable.paidAmount, 0)))
      .orderBy(desc(invTable.invoiceDate), desc(invTable.createdAt))
      .all();
    for (const inv of paid) {
      if (remaining <= 0) break;
      const reversed = Math.min(remaining, inv.paidAmount);
      const newBalance = inv.balance + reversed;
      tx.update(invTable)
        .set({ paidAmount: inv.paidAmount - reversed, balance: newBalance, status: newBalance <= 0 ? 'paid' : 'unpaid' })
        .where(eq(invTable.id, inv.id))
        .run();
      remaining -= reversed;
    }
  }
}

const voucherValues = (i: PaymentVoucherInput) => ({
  voucherNo: i.voucherNo, customerId: i.customerId, supplierId: i.supplierId,
  voucherDate: i.voucherDate, amount: toPaisa(i.amount), paymentMethod: i.paymentMethod,
  reference: i.reference, notes: i.notes,
});

function settleVoucherSide(tx: Tx, input: { customerId: string | null; supplierId: string | null }, amountPaisa: number, mode: 'apply' | 'reverse') {
  if (input.supplierId) {
    allocatePayment(tx, 'supplier', input.supplierId, amountPaisa, mode);
    recalcPartyBalance(tx, 'supplier', input.supplierId);
  } else if (input.customerId) {
    allocatePayment(tx, 'customer', input.customerId, amountPaisa, mode);
    recalcPartyBalance(tx, 'customer', input.customerId);
  }
}

export async function createPaymentVoucher(db: Db, input: PaymentVoucherInput): Promise<{ error?: string }> {
  db.transaction((tx) => {
    tx.insert(paymentVouchers).values({ ...voucherValues(input), createdAt: nowIso() }).run();
    settleVoucherSide(tx, input, toPaisa(input.amount), 'apply');
  });
  return {};
}

export async function updatePaymentVoucher(db: Db, id: string, input: PaymentVoucherInput): Promise<{ error?: string }> {
  db.transaction((tx) => {
    const old = tx.select().from(paymentVouchers).where(eq(paymentVouchers.id, id)).get();
    if (!old) return;
    tx.update(paymentVouchers).set(voucherValues(input)).where(eq(paymentVouchers.id, id)).run();
    settleVoucherSide(tx, { customerId: old.customerId, supplierId: old.supplierId }, old.amount, 'reverse');
    settleVoucherSide(tx, input, toPaisa(input.amount), 'apply');
  });
  return {};
}

export async function deletePaymentVoucher(db: Db, id: string): Promise<{ error?: string }> {
  db.transaction((tx) => {
    const old = tx.select().from(paymentVouchers).where(eq(paymentVouchers.id, id)).get();
    if (!old) return;
    tx.delete(paymentVouchers).where(eq(paymentVouchers.id, id)).run();
    settleVoucherSide(tx, { customerId: old.customerId, supplierId: old.supplierId }, old.amount, 'reverse');
  });
  return {};
}

// ------------------------------------------------------- expense vouchers
export interface ExpenseVoucherDto {
  id: string;
  voucherNo: string;
  expenseDate: string;
  category: string;
  description: string | null;
  amount: number;
  paidTo: string | null;
  createdAt: string | null;
}
export interface ExpenseVoucherInput {
  voucherNo: string;
  expenseDate: string;
  category: string;
  description: string | null;
  amount: number;
  paidTo: string | null;
}

const expenseToDto = (r: typeof expenseVouchers.$inferSelect): ExpenseVoucherDto => ({
  id: r.id, voucherNo: r.voucherNo, expenseDate: r.expenseDate, category: r.category,
  description: r.description, amount: fromPaisa(r.amount), paidTo: r.paidTo, createdAt: r.createdAt,
});
const expenseValues = (i: ExpenseVoucherInput) => ({
  voucherNo: i.voucherNo, expenseDate: i.expenseDate, category: i.category,
  description: i.description, amount: toPaisa(i.amount), paidTo: i.paidTo,
});

export async function listExpenseVouchers(db: Db): Promise<ExpenseVoucherDto[]> {
  const rows = await db.select().from(expenseVouchers)
    .orderBy(desc(expenseVouchers.createdAt));
  return rows.map(expenseToDto);
}
export async function createExpenseVoucher(db: Db, input: ExpenseVoucherInput): Promise<{ error?: string }> {
  await db.insert(expenseVouchers).values({ ...expenseValues(input), createdAt: nowIso() });
  return {};
}
export async function updateExpenseVoucher(db: Db, id: string, input: ExpenseVoucherInput): Promise<{ error?: string }> {
  await db.update(expenseVouchers).set(expenseValues(input)).where(eq(expenseVouchers.id, id));
  return {};
}
export async function deleteExpenseVoucher(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(expenseVouchers).where(eq(expenseVouchers.id, id));
  return {};
}

// ------------------------------------------------------------- gate passes
export interface GatePassDto {
  id: string;
  passNo: string;
  passType: string;
  customerId: string | null;
  customerName: string;
  passDate: string;
  referenceInvoice: string | null;
  itemsDescription: string | null;
  totalAmount: number;
  vehicleNo: string | null;
  driverName: string | null;
  notes: string | null;
  createdAt: string | null;
}
export type GatePassInput = Omit<GatePassDto, 'id' | 'createdAt'>;

const gatePassToDto = (r: typeof gatePasses.$inferSelect): GatePassDto => ({
  id: r.id, passNo: r.passNo, passType: r.passType, customerId: r.customerId,
  customerName: r.customerName, passDate: r.passDate, referenceInvoice: r.referenceInvoice,
  itemsDescription: r.itemsDescription, totalAmount: fromPaisa(r.totalAmount),
  vehicleNo: r.vehicleNo, driverName: r.driverName, notes: r.notes, createdAt: r.createdAt,
});
const gatePassValues = (i: GatePassInput) => ({
  passNo: i.passNo, passType: i.passType, customerId: i.customerId, customerName: i.customerName,
  passDate: i.passDate, referenceInvoice: i.referenceInvoice, itemsDescription: i.itemsDescription,
  totalAmount: toPaisa(i.totalAmount), vehicleNo: i.vehicleNo, driverName: i.driverName, notes: i.notes,
});

export async function listGatePasses(db: Db): Promise<GatePassDto[]> {
  const rows = await db.select().from(gatePasses)
    .orderBy(desc(gatePasses.createdAt));
  return rows.map(gatePassToDto);
}
export async function findGatePass(db: Db, passDate: string, notes: string): Promise<GatePassDto | null> {
  const [row] = await db.select().from(gatePasses)
    .where(and(eq(gatePasses.passDate, passDate), eq(gatePasses.notes, notes)));
  return row ? gatePassToDto(row) : null;
}

export async function countGatePasses(db: Db): Promise<number> {
  const rows = await db.select({ id: gatePasses.id }).from(gatePasses);
  return rows.length;
}
export async function createGatePass(db: Db, input: GatePassInput): Promise<{ error?: string }> {
  await db.insert(gatePasses).values({ ...gatePassValues(input), createdAt: nowIso() });
  return {};
}
export async function updateGatePass(db: Db, id: string, input: GatePassInput): Promise<{ error?: string }> {
  await db.update(gatePasses).set(gatePassValues(input)).where(eq(gatePasses.id, id));
  return {};
}
export async function deleteGatePass(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(gatePasses).where(eq(gatePasses.id, id));
  return {};
}
