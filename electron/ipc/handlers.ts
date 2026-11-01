// IPC registration for the main process. Kept behind a minimal interface so
// the wiring can be unit-tested without launching Electron.
import type { Db } from '../db/client';
import { getSettings, updateSettings, type SettingsDto } from '../services/settingsService';
import {
  signIn, getRecoveryQuestion, resetPassword,
  listUsers, createUser, deleteUser, updateUser,
  getPermissions, listAllPermissions,
} from '../services/authService';
import {
  listLicenses, createLicense, setLicenseActive, deleteLicense,
  type LicenseDto,
} from '../services/licenseService';
import {
  listInvoices, listInvoicesForParty, getInvoice, listInvoiceItems, countInvoices,
  createInvoice, updateInvoice, deleteInvoice, customerRates, listInvoicesByDate, findGatePass,
  listPaymentVouchers, listVouchersForParty, createPaymentVoucher, updatePaymentVoucher, deletePaymentVoucher,
  listExpenseVouchers, createExpenseVoucher, updateExpenseVoucher, deleteExpenseVoucher,
  listGatePasses, countGatePasses, createGatePass, updateGatePass, deleteGatePass,
  type PartyKind, type InvoiceInput, type InvoiceItemInput,
  type PaymentVoucherInput, type ExpenseVoucherInput, type GatePassInput,
} from '../services/transactionService';
import {
  dashboardStats, printDataset, reportsDataset,
  listSalesmanTargets, createSalesmanTarget, updateSalesmanTarget, deleteSalesmanTarget,
  type SalesmanTargetInput,
} from '../services/reportsService';
import {
  listCustomers, createCustomer, bulkCreateCustomers, updateCustomer, deleteCustomer, getCustomer,
  getProduct,
  listSuppliers, createSupplier, bulkCreateSuppliers, updateSupplier, deleteSupplier,
  listProducts, createProduct, bulkCreateProducts, updateProduct, deleteProduct,
  listRoutes, createRoute, updateRoute, deleteRoute,
  listCustomerRoutes, assignCustomerRoute, unassignCustomerRoute,
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  listSalaryPayments, createSalaryPayment, deleteSalaryPayment,
  listIncome, createIncome, updateIncome, deleteIncome,
  type PartyInput, type ProductInput, type RouteInput,
  type EmployeeInput, type SalaryPaymentInput, type IncomeInput,
} from '../services/masterService';

export interface IpcMainLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void;
}

export function registerHandlers(ipc: IpcMainLike, getDb: () => Db): void {
  // Settings (Phase 1)
  ipc.handle('settings:get', async () => getSettings(getDb()));
  ipc.handle('settings:update', async (_e, patch: Partial<SettingsDto>) => updateSettings(getDb(), patch));

  // Auth + users + permissions (Phase 2)
  ipc.handle('auth:signIn', async (_e, username: string, password: string) => signIn(getDb(), username, password));
  ipc.handle('auth:recoveryQuestion', async (_e, username: string) => getRecoveryQuestion(getDb(), username));
  ipc.handle('auth:resetPassword', async (_e, username: string, answer: string, newPassword: string) =>
    resetPassword(getDb(), username, answer, newPassword));
  ipc.handle('users:list', async () => listUsers(getDb()));
  ipc.handle('users:create', async (_e, username: string, password: string, permissions: string[] | null) =>
    createUser(getDb(), username, password, permissions));
  ipc.handle('users:delete', async (_e, userId: string) => deleteUser(getDb(), userId));
  ipc.handle('users:update', async (_e, opts: Parameters<typeof updateUser>[1]) => updateUser(getDb(), opts));
  ipc.handle('permissions:get', async (_e, userId: string) => getPermissions(getDb(), userId));
  ipc.handle('permissions:listAll', async () => listAllPermissions(getDb()));

  // Licenses registry (Phase 2)
  ipc.handle('licenses:list', async () => listLicenses(getDb()));
  ipc.handle('licenses:create', async (_e, input: Parameters<typeof createLicense>[1]) => createLicense(getDb(), input));
  ipc.handle('licenses:setActive', async (_e, id: string, isActive: boolean) => setLicenseActive(getDb(), id, isActive));
  ipc.handle('licenses:delete', async (_e, id: string) => deleteLicense(getDb(), id));
  // Master data (Phase 3)
  ipc.handle('customers:list', async () => listCustomers(getDb()));
  ipc.handle('customers:create', async (_e, input: PartyInput) => createCustomer(getDb(), input));
  ipc.handle('customers:bulkCreate', async (_e, inputs: PartyInput[]) => bulkCreateCustomers(getDb(), inputs));
  ipc.handle('customers:update', async (_e, id: string, input: PartyInput) => updateCustomer(getDb(), id, input));
  ipc.handle('customers:delete', async (_e, id: string) => deleteCustomer(getDb(), id));
  ipc.handle('suppliers:list', async () => listSuppliers(getDb()));
  ipc.handle('suppliers:create', async (_e, input: PartyInput) => createSupplier(getDb(), input));
  ipc.handle('suppliers:bulkCreate', async (_e, inputs: PartyInput[]) => bulkCreateSuppliers(getDb(), inputs));
  ipc.handle('suppliers:update', async (_e, id: string, input: PartyInput) => updateSupplier(getDb(), id, input));
  ipc.handle('suppliers:delete', async (_e, id: string) => deleteSupplier(getDb(), id));
  ipc.handle('products:list', async () => listProducts(getDb()));
  ipc.handle('products:create', async (_e, input: ProductInput) => createProduct(getDb(), input));
  ipc.handle('products:bulkCreate', async (_e, inputs: ProductInput[]) => bulkCreateProducts(getDb(), inputs));
  ipc.handle('products:update', async (_e, id: string, input: ProductInput) => updateProduct(getDb(), id, input));
  ipc.handle('products:delete', async (_e, id: string) => deleteProduct(getDb(), id));
  ipc.handle('routes:list', async () => listRoutes(getDb()));
  ipc.handle('routes:create', async (_e, input: RouteInput) => createRoute(getDb(), input));
  ipc.handle('routes:update', async (_e, id: string, input: RouteInput) => updateRoute(getDb(), id, input));
  ipc.handle('routes:delete', async (_e, id: string) => deleteRoute(getDb(), id));
  ipc.handle('customerRoutes:list', async () => listCustomerRoutes(getDb()));
  ipc.handle('customerRoutes:assign', async (_e, routeId: string, customerId: string) => assignCustomerRoute(getDb(), routeId, customerId));
  ipc.handle('customerRoutes:unassign', async (_e, id: string) => unassignCustomerRoute(getDb(), id));
  ipc.handle('employees:list', async () => listEmployees(getDb()));
  ipc.handle('employees:create', async (_e, input: EmployeeInput) => createEmployee(getDb(), input));
  ipc.handle('employees:update', async (_e, id: string, input: EmployeeInput) => updateEmployee(getDb(), id, input));
  ipc.handle('employees:delete', async (_e, id: string) => deleteEmployee(getDb(), id));
  ipc.handle('salaryPayments:list', async () => listSalaryPayments(getDb()));
  ipc.handle('salaryPayments:create', async (_e, input: SalaryPaymentInput) => createSalaryPayment(getDb(), input));
  ipc.handle('salaryPayments:delete', async (_e, id: string) => deleteSalaryPayment(getDb(), id));
  ipc.handle('income:list', async () => listIncome(getDb()));
  ipc.handle('income:create', async (_e, input: IncomeInput) => createIncome(getDb(), input));
  ipc.handle('income:update', async (_e, id: string, input: IncomeInput) => updateIncome(getDb(), id, input));
  ipc.handle('income:delete', async (_e, id: string) => deleteIncome(getDb(), id));
  ipc.handle('customers:get', async (_e, id: string) => getCustomer(getDb(), id));
  ipc.handle('products:get', async (_e, id: string) => getProduct(getDb(), id));
  // Transactions (Phase 4)
  ipc.handle('invoices:list', async (_e, kind: PartyKind, type: string) => listInvoices(getDb(), kind, type));
  ipc.handle('invoices:listForParty', async (_e, kind: PartyKind, partyId: string) => listInvoicesForParty(getDb(), kind, partyId));
  ipc.handle('invoices:get', async (_e, kind: PartyKind, id: string) => getInvoice(getDb(), kind, id));
  ipc.handle('invoices:items', async (_e, kind: PartyKind, invoiceId: string) => listInvoiceItems(getDb(), kind, invoiceId));
  ipc.handle('invoices:count', async (_e, kind: PartyKind, type: string) => countInvoices(getDb(), kind, type));
  ipc.handle('invoices:create', async (_e, kind: PartyKind, input: InvoiceInput, items: InvoiceItemInput[], opts?: { withGatePass?: boolean }) => createInvoice(getDb(), kind, input, items, opts));
  ipc.handle('invoices:update', async (_e, kind: PartyKind, id: string, input: InvoiceInput, items: InvoiceItemInput[]) => updateInvoice(getDb(), kind, id, input, items));
  ipc.handle('invoices:delete', async (_e, kind: PartyKind, id: string) => deleteInvoice(getDb(), kind, id));
  ipc.handle('invoices:customerRates', async (_e, customerId: string) => customerRates(getDb(), customerId));
  ipc.handle('invoices:listByDate', async (_e, kind: PartyKind, date: string) => listInvoicesByDate(getDb(), kind, date));
  ipc.handle('gatePasses:find', async (_e, passDate: string, notes: string) => findGatePass(getDb(), passDate, notes));
  ipc.handle('paymentVouchers:list', async () => listPaymentVouchers(getDb()));
  ipc.handle('paymentVouchers:listForParty', async (_e, kind: PartyKind, partyId: string) => listVouchersForParty(getDb(), kind, partyId));
  ipc.handle('paymentVouchers:create', async (_e, input: PaymentVoucherInput) => createPaymentVoucher(getDb(), input));
  ipc.handle('paymentVouchers:update', async (_e, id: string, input: PaymentVoucherInput) => updatePaymentVoucher(getDb(), id, input));
  ipc.handle('paymentVouchers:delete', async (_e, id: string) => deletePaymentVoucher(getDb(), id));
  ipc.handle('expenseVouchers:list', async () => listExpenseVouchers(getDb()));
  ipc.handle('expenseVouchers:create', async (_e, input: ExpenseVoucherInput) => createExpenseVoucher(getDb(), input));
  ipc.handle('expenseVouchers:update', async (_e, id: string, input: ExpenseVoucherInput) => updateExpenseVoucher(getDb(), id, input));
  ipc.handle('expenseVouchers:delete', async (_e, id: string) => deleteExpenseVoucher(getDb(), id));
  ipc.handle('gatePasses:list', async () => listGatePasses(getDb()));
  ipc.handle('gatePasses:count', async () => countGatePasses(getDb()));
  ipc.handle('gatePasses:create', async (_e, input: GatePassInput) => createGatePass(getDb(), input));
  ipc.handle('gatePasses:update', async (_e, id: string, input: GatePassInput) => updateGatePass(getDb(), id, input));
  ipc.handle('gatePasses:delete', async (_e, id: string) => deleteGatePass(getDb(), id));
  // Reports (Phase 5)
  ipc.handle('reports:dashboard', async (_e, today: string) => dashboardStats(getDb(), today));
  ipc.handle('reports:printDataset', async () => printDataset(getDb()));
  ipc.handle('reports:dataset', async () => reportsDataset(getDb()));
  ipc.handle('targets:list', async (_e, month: string) => listSalesmanTargets(getDb(), month));
  ipc.handle('targets:create', async (_e, input: SalesmanTargetInput) => createSalesmanTarget(getDb(), input));
  ipc.handle('targets:update', async (_e, id: string, input: SalesmanTargetInput) => updateSalesmanTarget(getDb(), id, input));
  ipc.handle('targets:delete', async (_e, id: string) => deleteSalesmanTarget(getDb(), id));
  // Phase 6: backup:* …
}

export type { LicenseDto };
