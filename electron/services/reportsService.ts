// Reports services (Phase 5): dashboard aggregates, the print-centre dataset,
// a full read dataset for the report pages (they compute in the renderer,
// exactly as the old pages computed over supabase rows), and salesman targets.
import { and, asc, eq, gte } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  customers, suppliers, products, routes, customerRoutes,
  customerInvoices, customerInvoiceItems, supplierInvoices, supplierInvoiceItems,
  paymentVouchers, expenseVouchers, gatePasses, employees, salaryPayments,
  incomeOptions, salesmanTargets,
} from '../db/schema';
import { fromPaisa, toPaisa } from '../lib/units';
import type { PartyDto, ProductDto, RouteDto, CustomerRouteDto, EmployeeDto, SalaryPaymentDto, IncomeDto } from './masterService';
import {
  listCustomers, listSuppliers, listProducts, listRoutes, listCustomerRoutes,
  listEmployees, listSalaryPayments, listIncome,
} from './masterService';
import type { InvoiceDto, InvoiceItemDto, PaymentVoucherDto, ExpenseVoucherDto, GatePassDto } from './transactionService';
import {
  listExpenseVouchers, listGatePasses, listInvoices, listPaymentVouchers,
} from './transactionService';
import { fromMilliQty, fromPercentX100 } from '../lib/units';

// ------------------------------------------------------------- dashboard
export interface DashboardStats {
  customers: number;
  suppliers: number;
  products: number;
  pendingInvoices: number;
  receivable: number;
  payable: number;
  todayPayments: number;
  lowStock: number;
  gatePasses: number;
}

export async function dashboardStats(db: Db, today: string): Promise<DashboardStats> {
  const cust = await db.select({ id: customers.id }).from(customers);
  const supp = await db.select({ id: suppliers.id }).from(suppliers);
  const prod = await db.select().from(products);
  // The old page queried status='unpaid' AND invoice_type in one go, for
  // both the receivable sum and the pending-invoices count.
  const saleRows = await db
    .select({ balance: customerInvoices.balance })
    .from(customerInvoices)
    .where(and(eq(customerInvoices.status, 'unpaid'), eq(customerInvoices.invoiceType, 'sale')));
  const purchaseRows = await db
    .select({ balance: supplierInvoices.balance })
    .from(supplierInvoices)
    .where(and(eq(supplierInvoices.status, 'unpaid'), eq(supplierInvoices.invoiceType, 'purchase')));
  const vouchers = await db
    .select({ amount: paymentVouchers.amount })
    .from(paymentVouchers)
    .where(gte(paymentVouchers.voucherDate, today));
  const passes = await db
    .select({ id: gatePasses.id })
    .from(gatePasses)
    .where(gte(gatePasses.passDate, today));
  const lowStock = prod.filter((p) => p.stockQuantity <= p.reorderLevel).length;
  return {
    customers: cust.length,
    suppliers: supp.length,
    products: prod.length,
    pendingInvoices: saleRows.length,
    receivable: fromPaisa(saleRows.reduce((s, r) => s + r.balance, 0)),
    payable: fromPaisa(purchaseRows.reduce((s, r) => s + r.balance, 0)),
    todayPayments: fromPaisa(vouchers.reduce((s, r) => s + r.amount, 0)),
    lowStock,
    gatePasses: passes.length,
  };
}

// ------------------------------------------------------------- print centre
export interface PrintDataset {
  sales: InvoiceDto[];
  salesReturns: InvoiceDto[];
  purchaseReturns: InvoiceDto[];
  items: InvoiceItemDto[];
  vouchers: PaymentVoucherDto[];
  gatePasses: GatePassDto[];
}

export async function printDataset(db: Db): Promise<PrintDataset> {
  const salesAll = await listInvoices(db, 'customer', 'sale');
  const salesReturns = await listInvoices(db, 'customer', 'sales-return');
  const purchaseReturns = await listInvoices(db, 'supplier', 'purchase-return');
  // The old page listed by invoice_date desc with limits; the service lists
  // newest first already — slice to the same limits.
  const sales = salesAll.slice(0, 500);
  const items: InvoiceItemDto[] = [];
  // Old page fetched customer_invoice_items (limit 5000) only; purchase-return
  // items were never found by it. We include supplier items too so purchase
  // returns print with their lines (quiet fix, same lookup by invoice_id).
  const custItems = await db.select().from(customerInvoiceItems).limit(5000);
  const suppItems = await db.select().from(supplierInvoiceItems).limit(5000);
  for (const r of [...custItems, ...suppItems]) {
    items.push({
      id: r.id, invoiceId: r.invoiceId, productId: r.productId, productName: r.productName,
      quantity: fromMilliQty(r.quantity), unitPrice: fromPaisa(r.unitPrice),
      discountPercent: fromPercentX100(r.discountPercent), total: fromPaisa(r.total),
      createdAt: r.createdAt,
    });
  }
  const vouchers = (await listPaymentVouchers(db)).slice(0, 300);
  const passes = (await listGatePasses(db)).slice(0, 300);
  return {
    sales,
    salesReturns: salesReturns.slice(0, 200),
    purchaseReturns: purchaseReturns.slice(0, 200),
    items, vouchers, gatePasses: passes,
  };
}

// ------------------------------------------------------------- full dataset
export interface ReportsDataset {
  customers: PartyDto[];
  suppliers: PartyDto[];
  products: ProductDto[];
  routes: RouteDto[];
  customerRoutes: CustomerRouteDto[];
  customerInvoices: InvoiceDto[];
  customerItems: InvoiceItemDto[];
  supplierInvoices: InvoiceDto[];
  supplierItems: InvoiceItemDto[];
  paymentVouchers: PaymentVoucherDto[];
  expenseVouchers: ExpenseVoucherDto[];
  gatePasses: GatePassDto[];
  employees: EmployeeDto[];
  salaryPayments: SalaryPaymentDto[];
  income: IncomeDto[];
}

export async function reportsDataset(db: Db): Promise<ReportsDataset> {
  const inv = async (kind: 'customer' | 'supplier', type: string) => listInvoices(db, kind, type);
  const customerInvoicesAll = [
    ...(await inv('customer', 'sale')),
    ...(await inv('customer', 'sales-return')),
  ];
  const supplierInvoicesAll = [
    ...(await inv('supplier', 'purchase')),
    ...(await inv('supplier', 'purchase-return')),
  ];
  const mapItem = (r: typeof customerInvoiceItems.$inferSelect): InvoiceItemDto => ({
    id: r.id, invoiceId: r.invoiceId, productId: r.productId, productName: r.productName,
    quantity: fromMilliQty(r.quantity), unitPrice: fromPaisa(r.unitPrice),
    discountPercent: fromPercentX100(r.discountPercent), total: fromPaisa(r.total),
    createdAt: r.createdAt,
  });
  return {
    customers: await listCustomers(db),
    suppliers: await listSuppliers(db),
    products: await listProducts(db),
    routes: await listRoutes(db),
    customerRoutes: await listCustomerRoutes(db),
    customerInvoices: customerInvoicesAll,
    customerItems: (await db.select().from(customerInvoiceItems)).map(mapItem),
    supplierInvoices: supplierInvoicesAll,
    supplierItems: (await db.select().from(supplierInvoiceItems)).map(mapItem),
    paymentVouchers: await listPaymentVouchers(db),
    expenseVouchers: await listExpenseVouchers(db),
    gatePasses: await listGatePasses(db),
    employees: await listEmployees(db),
    salaryPayments: await listSalaryPayments(db),
    income: await listIncome(db),
  };
}

// ------------------------------------------------------------- salesman targets
export interface SalesmanTargetDto {
  id: string;
  routeId: string | null;
  salesmanName: string;
  targetMonth: string;
  targetAmount: number;
  createdAt: string | null;
  routeName: string | null;
}
export interface SalesmanTargetInput {
  routeId: string | null;
  salesmanName: string;
  targetMonth: string;
  targetAmount: number;
}

export async function listSalesmanTargets(db: Db, month: string): Promise<SalesmanTargetDto[]> {
  const rows = await db
    .select({ t: salesmanTargets, route: routes })
    .from(salesmanTargets)
    .leftJoin(routes, eq(salesmanTargets.routeId, routes.id))
    .where(eq(salesmanTargets.targetMonth, month))
    .orderBy(asc(salesmanTargets.salesmanName));
  return rows.map(({ t, route }) => ({
    id: t.id, routeId: t.routeId, salesmanName: t.salesmanName,
    targetMonth: t.targetMonth, targetAmount: fromPaisa(t.targetAmount),
    createdAt: t.createdAt, routeName: route?.name ?? null,
  }));
}
export async function createSalesmanTarget(db: Db, input: SalesmanTargetInput): Promise<{ error?: string }> {
  await db.insert(salesmanTargets).values({
    routeId: input.routeId, salesmanName: input.salesmanName,
    targetMonth: input.targetMonth, targetAmount: toPaisa(input.targetAmount),
  });
  return {};
}
export async function updateSalesmanTarget(db: Db, id: string, input: SalesmanTargetInput): Promise<{ error?: string }> {
  await db.update(salesmanTargets).set({
    routeId: input.routeId, salesmanName: input.salesmanName,
    targetMonth: input.targetMonth, targetAmount: toPaisa(input.targetAmount),
  }).where(eq(salesmanTargets.id, id));
  return {};
}
export async function deleteSalesmanTarget(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(salesmanTargets).where(eq(salesmanTargets.id, id));
  return {};
}
