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
  listCustomers, createCustomer, bulkCreateCustomers, updateCustomer, deleteCustomer,
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
  // Phase 4+: invoices:*, vouchers:*, reports:*, backup:* …
}

export type { LicenseDto };
