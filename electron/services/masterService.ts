// Master-data services (Phase 3): customers, suppliers, products, routes +
// assignments, employees + salary payments, other income.
// Faithful ports of the pages' old supabase calls — same ordering, same
// payload meanings. Conversions at this boundary only (D8): money rupees <->
// paisa, quantities <-> milli-units. Delete follows the schema's FK rules and
// returns a friendly { error } instead of throwing, mirroring how the CSV
// import in the old pages reported failures.
import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  customers, suppliers, products, routes, customerRoutes,
  employees, salaryPayments, incomeOptions,
} from '../db/schema';
import { toPaisa, fromPaisa, toMilliQty, fromMilliQty } from '../lib/units';

// ---------------------------------------------------------------- parties
export interface PartyDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  openingBalance: number; // rupees
  currentBalance: number; // rupees
  balanceType: string;
  createdAt: string | null;
}

export interface PartyInput {
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  openingBalance: number; // rupees
  currentBalance: number; // rupees
}

type PartyRow = typeof customers.$inferSelect;

const partyToDto = (r: PartyRow): PartyDto => ({
  id: r.id, name: r.name, phone: r.phone, address: r.address, city: r.city,
  openingBalance: fromPaisa(r.openingBalance), currentBalance: fromPaisa(r.currentBalance),
  balanceType: r.balanceType, createdAt: r.createdAt,
});
const partyValues = (i: PartyInput) => ({
  name: i.name, phone: i.phone, address: i.address, city: i.city,
  openingBalance: toPaisa(i.openingBalance), currentBalance: toPaisa(i.currentBalance),
});

export async function listCustomers(db: Db): Promise<PartyDto[]> {
  const rows = await db.select().from(customers).orderBy(asc(customers.name));
  return rows.map(partyToDto);
}
export async function createCustomer(db: Db, input: PartyInput): Promise<{ error?: string }> {
  await db.insert(customers).values(partyValues(input));
  return {};
}
export async function bulkCreateCustomers(db: Db, inputs: PartyInput[]): Promise<{ error?: string; count: number }> {
  try {
    if (inputs.length > 0) await db.insert(customers).values(inputs.map(partyValues));
    return { count: inputs.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed', count: 0 };
  }
}
export async function updateCustomer(db: Db, id: string, input: PartyInput): Promise<{ error?: string }> {
  await db.update(customers).set(partyValues(input)).where(eq(customers.id, id));
  return {};
}
export async function deleteCustomer(db: Db, id: string): Promise<{ error?: string }> {
  try {
    await db.delete(customers).where(eq(customers.id, id));
    return {};
  } catch {
    return { error: 'This customer has invoices or payments and cannot be deleted.' };
  }
}

export async function listSuppliers(db: Db): Promise<PartyDto[]> {
  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name));
  return rows.map(partyToDto);
}
export async function createSupplier(db: Db, input: PartyInput): Promise<{ error?: string }> {
  await db.insert(suppliers).values(partyValues(input));
  return {};
}
export async function bulkCreateSuppliers(db: Db, inputs: PartyInput[]): Promise<{ error?: string; count: number }> {
  try {
    if (inputs.length > 0) await db.insert(suppliers).values(inputs.map(partyValues));
    return { count: inputs.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed', count: 0 };
  }
}
export async function updateSupplier(db: Db, id: string, input: PartyInput): Promise<{ error?: string }> {
  await db.update(suppliers).set(partyValues(input)).where(eq(suppliers.id, id));
  return {};
}
export async function deleteSupplier(db: Db, id: string): Promise<{ error?: string }> {
  try {
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return {};
  } catch {
    return { error: 'This supplier has invoices or payments and cannot be deleted.' };
  }
}

// ---------------------------------------------------------------- products
export interface ProductDto {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  purchasePrice: number; // rupees
  salePrice: number; // rupees
  stockQuantity: number; // plain units
  reorderLevel: number; // plain units
  createdAt: string | null;
}

export interface ProductInput {
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  reorderLevel: number;
}

type ProductRow = typeof products.$inferSelect;

const productToDto = (r: ProductRow): ProductDto => ({
  id: r.id, name: r.name, sku: r.sku, category: r.category, unit: r.unit,
  purchasePrice: fromPaisa(r.purchasePrice), salePrice: fromPaisa(r.salePrice),
  stockQuantity: fromMilliQty(r.stockQuantity), reorderLevel: fromMilliQty(r.reorderLevel),
  createdAt: r.createdAt,
});
const productValues = (i: ProductInput) => ({
  name: i.name, sku: i.sku, category: i.category, unit: i.unit,
  purchasePrice: toPaisa(i.purchasePrice), salePrice: toPaisa(i.salePrice),
  stockQuantity: toMilliQty(i.stockQuantity), reorderLevel: toMilliQty(i.reorderLevel),
});

export async function listProducts(db: Db): Promise<ProductDto[]> {
  const rows = await db.select().from(products).orderBy(asc(products.name));
  return rows.map(productToDto);
}
export async function createProduct(db: Db, input: ProductInput): Promise<{ error?: string }> {
  await db.insert(products).values(productValues(input));
  return {};
}
export async function bulkCreateProducts(db: Db, inputs: ProductInput[]): Promise<{ error?: string; count: number }> {
  try {
    if (inputs.length > 0) await db.insert(products).values(inputs.map(productValues));
    return { count: inputs.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed', count: 0 };
  }
}
export async function updateProduct(db: Db, id: string, input: ProductInput): Promise<{ error?: string }> {
  await db.update(products).set(productValues(input)).where(eq(products.id, id));
  return {};
}
export async function deleteProduct(db: Db, id: string): Promise<{ error?: string }> {
  // Invoice items keep their product_name snapshot; product_id becomes NULL
  // (schema ON DELETE SET NULL), exactly like the old Postgres behaviour.
  await db.delete(products).where(eq(products.id, id));
  return {};
}

// ---------------------------------------------------------------- routes
export interface RouteDto {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: number;
  sortOrder: number;
  createdAt: string | null;
}

export interface RouteInput {
  name: string;
  description: string | null;
  dayOfWeek: number;
  sortOrder: number;
}

export interface CustomerRouteDto {
  id: string;
  customerId: string;
  routeId: string;
  createdAt: string | null;
}

export async function listRoutes(db: Db): Promise<RouteDto[]> {
  const rows = await db.select().from(routes).orderBy(asc(routes.sortOrder));
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description,
    dayOfWeek: r.dayOfWeek, sortOrder: r.sortOrder, createdAt: r.createdAt,
  }));
}
export async function createRoute(db: Db, input: RouteInput): Promise<{ error?: string }> {
  await db.insert(routes).values(input);
  return {};
}
export async function updateRoute(db: Db, id: string, input: RouteInput): Promise<{ error?: string }> {
  await db.update(routes).set(input).where(eq(routes.id, id));
  return {};
}
export async function deleteRoute(db: Db, id: string): Promise<{ error?: string }> {
  // customer_routes and salesman_targets cascade (schema), as before.
  await db.delete(routes).where(eq(routes.id, id));
  return {};
}
export async function listCustomerRoutes(db: Db): Promise<CustomerRouteDto[]> {
  const rows = await db.select().from(customerRoutes);
  return rows.map((r) => ({
    id: r.id, customerId: r.customerId, routeId: r.routeId, createdAt: r.createdAt,
  }));
}
export async function assignCustomerRoute(db: Db, routeId: string, customerId: string): Promise<{ error?: string }> {
  await db.insert(customerRoutes).values({ routeId, customerId });
  return {};
}
export async function unassignCustomerRoute(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(customerRoutes).where(eq(customerRoutes.id, id));
  return {};
}

// ---------------------------------------------------------------- employees + salaries
export interface EmployeeDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  position: string | null;
  salary: number; // rupees
  hireDate: string | null;
  isActive: boolean;
  createdAt: string | null;
}

export interface EmployeeInput {
  name: string;
  phone: string | null;
  address: string | null;
  position: string | null;
  salary: number; // rupees
  hireDate: string;
}

export interface SalaryPaymentDto {
  id: string;
  employeeId: string;
  paymentDate: string;
  amount: number; // rupees
  month: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string | null;
  employee: EmployeeDto | null;
}

export interface SalaryPaymentInput {
  employeeId: string;
  paymentDate: string;
  amount: number; // rupees
  month: string;
  paymentMethod: string;
  notes: string | null;
}

type EmployeeRow = typeof employees.$inferSelect;

const employeeToDto = (r: EmployeeRow): EmployeeDto => ({
  id: r.id, name: r.name, phone: r.phone, address: r.address, position: r.position,
  salary: fromPaisa(r.salary), hireDate: r.hireDate, isActive: r.isActive, createdAt: r.createdAt,
});

export async function listEmployees(db: Db): Promise<EmployeeDto[]> {
  const rows = await db.select().from(employees).orderBy(asc(employees.name));
  return rows.map(employeeToDto);
}
export async function createEmployee(db: Db, input: EmployeeInput): Promise<{ error?: string }> {
  await db.insert(employees).values({
    name: input.name, phone: input.phone, address: input.address, position: input.position,
    salary: toPaisa(input.salary), hireDate: input.hireDate,
  });
  return {};
}
export async function updateEmployee(db: Db, id: string, input: EmployeeInput): Promise<{ error?: string }> {
  await db.update(employees).set({
    name: input.name, phone: input.phone, address: input.address, position: input.position,
    salary: toPaisa(input.salary), hireDate: input.hireDate,
  }).where(eq(employees.id, id));
  return {};
}
export async function deleteEmployee(db: Db, id: string): Promise<{ error?: string }> {
  // Salary payments cascade (schema), as before.
  await db.delete(employees).where(eq(employees.id, id));
  return {};
}

export async function listSalaryPayments(db: Db): Promise<SalaryPaymentDto[]> {
  const rows = await db
    .select({ payment: salaryPayments, employee: employees })
    .from(salaryPayments)
    .leftJoin(employees, eq(salaryPayments.employeeId, employees.id))
    .orderBy(desc(salaryPayments.createdAt));
  return rows.map(({ payment: p, employee: e }) => ({
    id: p.id, employeeId: p.employeeId, paymentDate: p.paymentDate,
    amount: fromPaisa(p.amount), month: p.month, paymentMethod: p.paymentMethod,
    notes: p.notes, createdAt: p.createdAt,
    employee: e ? employeeToDto(e) : null,
  }));
}
export async function createSalaryPayment(db: Db, input: SalaryPaymentInput): Promise<{ error?: string }> {
  await db.insert(salaryPayments).values({
    employeeId: input.employeeId, paymentDate: input.paymentDate,
    amount: toPaisa(input.amount), month: input.month,
    paymentMethod: input.paymentMethod, notes: input.notes,
  });
  return {};
}
export async function deleteSalaryPayment(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(salaryPayments).where(eq(salaryPayments.id, id));
  return {};
}

// ---------------------------------------------------------------- other income
export interface IncomeDto {
  id: string;
  description: string;
  amount: number; // rupees
  incomeDate: string;
  category: string;
  reference: string | null;
  createdAt: string | null;
}

export interface IncomeInput {
  description: string;
  amount: number; // rupees
  incomeDate: string;
  category: string;
  reference: string | null;
}

export async function listIncome(db: Db): Promise<IncomeDto[]> {
  const rows = await db.select().from(incomeOptions).orderBy(desc(incomeOptions.incomeDate));
  return rows.map((r) => ({
    id: r.id, description: r.description, amount: fromPaisa(r.amount),
    incomeDate: r.incomeDate, category: r.category, reference: r.reference, createdAt: r.createdAt,
  }));
}
export async function createIncome(db: Db, input: IncomeInput): Promise<{ error?: string }> {
  await db.insert(incomeOptions).values({
    description: input.description, amount: toPaisa(input.amount),
    incomeDate: input.incomeDate, category: input.category, reference: input.reference,
  });
  return {};
}
export async function updateIncome(db: Db, id: string, input: IncomeInput): Promise<{ error?: string }> {
  await db.update(incomeOptions).set({
    description: input.description, amount: toPaisa(input.amount),
    incomeDate: input.incomeDate, category: input.category, reference: input.reference,
  }).where(eq(incomeOptions.id, id));
  return {};
}
export async function deleteIncome(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(incomeOptions).where(eq(incomeOptions.id, id));
  return {};
}
