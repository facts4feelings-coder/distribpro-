// Renderer-side typed client for the Electron main-process API
// (window.api, exposed by electron/preload.ts). Pages migrate from
// `supabase.from(...)` / PGlite helpers to `api.<module>.<method>(...)`
// module by module: Settings (Phase 1), Auth/Users/Permissions/Licenses
// (Phase 2), master data (Phase 3), transactions (Phase 4), reports (5),
// backup (6).
// DTOs speak UI units (DECISIONS D8): taxRate is a plain percent number,
// money is rupees — integer paisa never crosses this boundary.
import type {
  Settings, Customer, Supplier, Product, Route, CustomerRoute,
  Employee, SalaryPaymentWithEmployee, IncomeOption,
  CustomerInvoice, SupplierInvoice, CustomerInvoiceItem, SupplierInvoiceItem,
  PaymentVoucher, ExpenseVoucher, GatePass,
} from './types';

export interface SettingsDto {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currencySymbol: string;
  taxRate: number;
  invoicePrefix: string;
  supplierInvoicePrefix: string;
  paymentVoucherPrefix: string;
  expenseVoucherPrefix: string;
  gatePassPrefix: string;
  salesReturnPrefix: string;
  purchaseReturnPrefix: string;
  defaultPrintFormat: string;
  thermalPrinterWidth: string;
  invoiceFooterNote: string;
  createdAt: string | null;
}

/** Adapter so the 26 existing useSettings() consumers keep receiving the
 *  legacy snake_case Settings shape untouched. */
export function settingsDtoToLegacy(d: SettingsDto): Settings {
  return {
    id: d.id,
    company_name: d.companyName,
    company_address: d.companyAddress,
    company_phone: d.companyPhone,
    company_email: d.companyEmail,
    currency_symbol: d.currencySymbol,
    tax_rate: d.taxRate,
    invoice_prefix: d.invoicePrefix,
    supplier_invoice_prefix: d.supplierInvoicePrefix,
    payment_voucher_prefix: d.paymentVoucherPrefix,
    expense_voucher_prefix: d.expenseVoucherPrefix,
    gate_pass_prefix: d.gatePassPrefix,
    sales_return_prefix: d.salesReturnPrefix,
    purchase_return_prefix: d.purchaseReturnPrefix,
    default_print_format: d.defaultPrintFormat,
    thermal_printer_width: d.thermalPrinterWidth,
    invoice_footer_note: d.invoiceFooterNote,
  };
}

export function settingsLegacyToDtoPatch(s: Partial<Settings>): Partial<Omit<SettingsDto, 'id' | 'createdAt'>> {
  const out: Partial<Omit<SettingsDto, 'id' | 'createdAt'>> = {};
  if (s.company_name !== undefined) out.companyName = s.company_name;
  if (s.company_address !== undefined) out.companyAddress = s.company_address;
  if (s.company_phone !== undefined) out.companyPhone = s.company_phone;
  if (s.company_email !== undefined) out.companyEmail = s.company_email;
  if (s.currency_symbol !== undefined) out.currencySymbol = s.currency_symbol;
  if (s.tax_rate !== undefined) out.taxRate = s.tax_rate;
  if (s.invoice_prefix !== undefined) out.invoicePrefix = s.invoice_prefix;
  if (s.supplier_invoice_prefix !== undefined) out.supplierInvoicePrefix = s.supplier_invoice_prefix;
  if (s.payment_voucher_prefix !== undefined) out.paymentVoucherPrefix = s.payment_voucher_prefix;
  if (s.expense_voucher_prefix !== undefined) out.expenseVoucherPrefix = s.expense_voucher_prefix;
  if (s.gate_pass_prefix !== undefined) out.gatePassPrefix = s.gate_pass_prefix;
  if (s.sales_return_prefix !== undefined) out.salesReturnPrefix = s.sales_return_prefix;
  if (s.purchase_return_prefix !== undefined) out.purchaseReturnPrefix = s.purchase_return_prefix;
  if (s.default_print_format !== undefined) out.defaultPrintFormat = s.default_print_format;
  if (s.thermal_printer_width !== undefined) out.thermalPrinterWidth = s.thermal_printer_width;
  if (s.invoice_footer_note !== undefined) out.invoiceFooterNote = s.invoice_footer_note ?? '';
  return out;
}

export interface SessionUser {
  id: string;
  username: string;
  permissions: string[];
}

export interface LicenseDto {
  id: string;
  licenseKey: string;
  customerName: string;
  maxDevices: number;
  expiresAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- Phase 3
// Master-data DTOs (mirror electron/services/masterService.ts) + adapters so
// the pages keep their legacy snake_case row types untouched.
export interface PartyDto {
  id: string; name: string; phone: string | null; address: string | null; city: string | null;
  openingBalance: number; currentBalance: number; balanceType: string; createdAt: string | null;
}
export interface PartyInput {
  name: string; phone: string | null; address: string | null; city: string | null;
  openingBalance: number; currentBalance: number;
}
export function partyDtoToLegacy(d: PartyDto): Customer {
  return {
    id: d.id, name: d.name, phone: d.phone, address: d.address, city: d.city,
    opening_balance: d.openingBalance, current_balance: d.currentBalance,
    balance_type: d.balanceType, created_at: d.createdAt ?? '',
  };
}
export const supplierDtoToLegacy = (d: PartyDto): Supplier => partyDtoToLegacy(d) as Supplier;
export function partyInputFromLegacy(p: {
  name: string; phone: string | null; address: string | null; city: string | null;
  opening_balance: number; current_balance: number;
}): PartyInput {
  return {
    name: p.name, phone: p.phone, address: p.address, city: p.city,
    openingBalance: p.opening_balance, currentBalance: p.current_balance,
  };
}

export interface ProductDto {
  id: string; name: string; sku: string | null; category: string | null; unit: string;
  purchasePrice: number; salePrice: number; stockQuantity: number; reorderLevel: number;
  createdAt: string | null;
}
export interface ProductInput {
  name: string; sku: string | null; category: string | null; unit: string;
  purchasePrice: number; salePrice: number; stockQuantity: number; reorderLevel: number;
}
export function productDtoToLegacy(d: ProductDto): Product {
  return {
    id: d.id, name: d.name, sku: d.sku, category: d.category, unit: d.unit,
    purchase_price: d.purchasePrice, sale_price: d.salePrice,
    stock_quantity: d.stockQuantity, reorder_level: d.reorderLevel, created_at: d.createdAt ?? '',
  };
}
export function productInputFromLegacy(p: {
  name: string; sku: string | null; category: string | null; unit: string;
  purchase_price: number; sale_price: number; stock_quantity: number; reorder_level: number;
}): ProductInput {
  return {
    name: p.name, sku: p.sku, category: p.category, unit: p.unit,
    purchasePrice: p.purchase_price, salePrice: p.sale_price,
    stockQuantity: p.stock_quantity, reorderLevel: p.reorder_level,
  };
}

export interface RouteDto {
  id: string; name: string; description: string | null; dayOfWeek: number; sortOrder: number;
  createdAt: string | null;
}
export interface RouteInput {
  name: string; description: string | null; dayOfWeek: number; sortOrder: number;
}
export function routeDtoToLegacy(d: RouteDto): Route {
  return {
    id: d.id, name: d.name, description: d.description,
    day_of_week: d.dayOfWeek, sort_order: d.sortOrder, created_at: d.createdAt ?? '',
  };
}
export interface CustomerRouteDto {
  id: string; customerId: string; routeId: string; createdAt: string | null;
}
export function customerRouteDtoToLegacy(d: CustomerRouteDto): CustomerRoute {
  return { id: d.id, customer_id: d.customerId, route_id: d.routeId, created_at: d.createdAt ?? '' };
}

export interface EmployeeDto {
  id: string; name: string; phone: string | null; address: string | null; position: string | null;
  salary: number; hireDate: string | null; isActive: boolean; createdAt: string | null;
}
export interface EmployeeInput {
  name: string; phone: string | null; address: string | null; position: string | null;
  salary: number; hireDate: string;
}
export function employeeDtoToLegacy(d: EmployeeDto): Employee {
  return {
    id: d.id, name: d.name, phone: d.phone, address: d.address, position: d.position,
    salary: d.salary, hire_date: d.hireDate ?? '', is_active: d.isActive, created_at: d.createdAt ?? '',
  };
}
export interface SalaryPaymentDto {
  id: string; employeeId: string; paymentDate: string; amount: number; month: string;
  paymentMethod: string; notes: string | null; createdAt: string | null; employee: EmployeeDto | null;
}
export interface SalaryPaymentInput {
  employeeId: string; paymentDate: string; amount: number; month: string;
  paymentMethod: string; notes: string | null;
}
export function salaryPaymentDtoToLegacy(d: SalaryPaymentDto): SalaryPaymentWithEmployee {
  return {
    id: d.id, employee_id: d.employeeId, payment_date: d.paymentDate, amount: d.amount,
    month: d.month, payment_method: d.paymentMethod, notes: d.notes, created_at: d.createdAt ?? '',
    employees: d.employee ? employeeDtoToLegacy(d.employee) : undefined,
  };
}

export interface IncomeDto {
  id: string; description: string; amount: number; incomeDate: string; category: string;
  reference: string | null; createdAt: string | null;
}
export interface IncomeInput {
  description: string; amount: number; incomeDate: string; category: string; reference: string | null;
}
export function incomeDtoToLegacy(d: IncomeDto): IncomeOption {
  return {
    id: d.id, description: d.description, amount: d.amount, income_date: d.incomeDate,
    category: d.category, reference: d.reference, created_at: d.createdAt ?? '',
  };
}

// ---------------------------------------------------------------- Phase 4
// Transaction DTOs (mirror electron/services/transactionService.ts).
export type PartyKind = 'customer' | 'supplier';

export interface InvoiceItemDto {
  id: string; invoiceId: string; productId: string | null; productName: string;
  quantity: number; unitPrice: number; discountPercent: number; total: number; createdAt: string | null;
}
export interface InvoiceItemInput {
  productId: string | null; productName: string; quantity: number;
  unitPrice: number; discountPercent: number; total: number;
}
export interface InvoiceDto {
  id: string; invoiceNo: string; partyId: string; invoiceDate: string; dueDate: string | null;
  subtotal: number; discount: number; tax: number; total: number; paidAmount: number;
  balance: number; status: string; paymentType: string | null; notes: string | null;
  invoiceType: string; createdAt: string | null; party: PartyDto | null;
}
export interface InvoiceInput {
  invoiceNo: string; partyId: string; invoiceDate: string; dueDate: string | null;
  subtotal: number; discount: number; tax: number; total: number; paidAmount: number;
  balance: number; status: string; paymentType?: string | null; notes: string | null; invoiceType: string;
}

export function invoiceDtoToCustomerLegacy(d: InvoiceDto): CustomerInvoice & { customers?: Customer } {
  return {
    id: d.id, invoice_no: d.invoiceNo, customer_id: d.partyId, invoice_date: d.invoiceDate,
    due_date: d.dueDate, subtotal: d.subtotal, discount: d.discount, tax: d.tax, total: d.total,
    paid_amount: d.paidAmount, balance: d.balance, status: d.status,
    payment_type: d.paymentType ?? undefined, notes: d.notes, invoice_type: d.invoiceType,
    created_at: d.createdAt ?? '', customers: d.party ? partyDtoToLegacy(d.party) : undefined,
  };
}
export function invoiceDtoToSupplierLegacy(d: InvoiceDto): SupplierInvoice & { suppliers?: Supplier } {
  return {
    id: d.id, invoice_no: d.invoiceNo, supplier_id: d.partyId, invoice_date: d.invoiceDate,
    due_date: d.dueDate, subtotal: d.subtotal, discount: d.discount, tax: d.tax, total: d.total,
    paid_amount: d.paidAmount, balance: d.balance, status: d.status,
    notes: d.notes, invoice_type: d.invoiceType, created_at: d.createdAt ?? '',
    suppliers: d.party ? supplierDtoToLegacy(d.party) : undefined,
  };
}
export function invoiceItemDtoToLegacy(d: InvoiceItemDto): CustomerInvoiceItem {
  return {
    id: d.id, invoice_id: d.invoiceId, product_id: d.productId, product_name: d.productName,
    quantity: d.quantity, unit_price: d.unitPrice, discount_percent: d.discountPercent,
    total: d.total, created_at: d.createdAt ?? '',
  };
}
export const supplierItemDtoToLegacy = (d: InvoiceItemDto): SupplierInvoiceItem => invoiceItemDtoToLegacy(d);

export function invoiceInputFromLegacy(p: {
  invoice_no: string; invoice_date: string; due_date: string | null;
  subtotal: number; discount: number; tax: number; total: number;
  paid_amount: number; balance: number; status: string;
  payment_type?: string | null; notes: string | null; invoice_type: string;
}, partyId: string): InvoiceInput {
  return {
    invoiceNo: p.invoice_no, partyId, invoiceDate: p.invoice_date, dueDate: p.due_date,
    subtotal: p.subtotal, discount: p.discount, tax: p.tax, total: p.total,
    paidAmount: p.paid_amount, balance: p.balance, status: p.status,
    paymentType: p.payment_type ?? null, notes: p.notes, invoiceType: p.invoice_type,
  };
}
export function invoiceItemsInputFromLegacy(items: {
  product_id: string | null; product_name: string; quantity: number;
  unit_price: number; discount_percent: number; total: number;
}[]): InvoiceItemInput[] {
  return items.map((i) => ({
    productId: i.product_id, productName: i.product_name, quantity: i.quantity,
    unitPrice: i.unit_price, discountPercent: i.discount_percent, total: i.total,
  }));
}

export interface PaymentVoucherDto {
  id: string; voucherNo: string; customerId: string | null; supplierId: string | null;
  voucherDate: string; amount: number; paymentMethod: string; reference: string | null;
  notes: string | null; createdAt: string | null; customer: PartyDto | null; supplier: PartyDto | null;
}
export interface PaymentVoucherInput {
  voucherNo: string; customerId: string | null; supplierId: string | null;
  voucherDate: string; amount: number; paymentMethod: string; reference: string | null; notes: string | null;
}
export function paymentVoucherDtoToLegacy(
  d: PaymentVoucherDto,
): PaymentVoucher & { customers?: Customer; suppliers?: Supplier } {
  return {
    id: d.id, voucher_no: d.voucherNo, customer_id: d.customerId, supplier_id: d.supplierId,
    voucher_date: d.voucherDate, amount: d.amount, payment_method: d.paymentMethod,
    reference: d.reference, notes: d.notes, created_at: d.createdAt ?? '',
    customers: d.customer ? partyDtoToLegacy(d.customer) : undefined,
    suppliers: d.supplier ? supplierDtoToLegacy(d.supplier) : undefined,
  };
}

export interface ExpenseVoucherDto {
  id: string; voucherNo: string; expenseDate: string; category: string;
  description: string | null; amount: number; paidTo: string | null; createdAt: string | null;
}
export interface ExpenseVoucherInput {
  voucherNo: string; expenseDate: string; category: string;
  description: string | null; amount: number; paidTo: string | null;
}
export function expenseVoucherDtoToLegacy(d: ExpenseVoucherDto): ExpenseVoucher {
  return {
    id: d.id, voucher_no: d.voucherNo, expense_date: d.expenseDate, category: d.category,
    description: d.description, amount: d.amount, paid_to: d.paidTo, created_at: d.createdAt ?? '',
  };
}

export interface GatePassDto {
  id: string; passNo: string; passType: string; customerId: string | null; customerName: string;
  passDate: string; referenceInvoice: string | null; itemsDescription: string | null;
  totalAmount: number; vehicleNo: string | null; driverName: string | null;
  notes: string | null; createdAt: string | null;
}
export type GatePassInput = Omit<GatePassDto, 'id' | 'createdAt'>;
export function gatePassDtoToLegacy(d: GatePassDto): GatePass {
  return {
    id: d.id, pass_no: d.passNo, pass_type: d.passType, customer_id: d.customerId,
    customer_name: d.customerName, pass_date: d.passDate, reference_invoice: d.referenceInvoice,
    items_description: d.itemsDescription, total_amount: d.totalAmount,
    vehicle_no: d.vehicleNo, driver_name: d.driverName, notes: d.notes, created_at: d.createdAt ?? '',
  };
}
export function gatePassInputFromLegacy(p: {
  pass_no: string; pass_type: string; customer_id: string | null; customer_name: string;
  pass_date: string; reference_invoice: string | null; items_description: string | null;
  total_amount: number; vehicle_no?: string | null; driver_name?: string | null; notes?: string | null;
}): GatePassInput {
  return {
    passNo: p.pass_no, passType: p.pass_type, customerId: p.customer_id, customerName: p.customer_name,
    passDate: p.pass_date, referenceInvoice: p.reference_invoice, itemsDescription: p.items_description,
    totalAmount: p.total_amount, vehicleNo: p.vehicle_no ?? null, driverName: p.driver_name ?? null,
    notes: p.notes ?? null,
  };
}

export interface UpdateUserOpts {
  userId: string;
  username: string;
  permissions: string[] | null;
  recoveryQuestion?: string | null;
  recoveryAnswer?: string | null;
}

interface DistribProApi {
  settings: {
    get(): Promise<SettingsDto>;
    update(patch: Partial<Omit<SettingsDto, 'id' | 'createdAt'>>): Promise<SettingsDto>;
  };
  auth: {
    signIn(username: string, password: string): Promise<{ user?: SessionUser; error?: string }>;
    recoveryQuestion(username: string): Promise<{ question?: string; error?: string }>;
    resetPassword(username: string, answer: string, newPassword: string): Promise<{ error?: string }>;
  };
  users: {
    list(): Promise<{ users: { id: string; username: string }[] }>;
    create(username: string, password: string, permissions: string[] | null): Promise<{ error?: string }>;
    delete(userId: string): Promise<{ error?: string }>;
    update(opts: UpdateUserOpts): Promise<{ error?: string }>;
  };
  permissions: {
    get(userId: string): Promise<string[] | null>;
    listAll(): Promise<{ userId: string; permissions: string[] }[]>;
  };
  licenses: {
    list(): Promise<LicenseDto[]>;
    create(input: {
      licenseKey: string;
      customerName: string;
      maxDevices: number;
      expiresAt: string | null;
      isActive?: boolean;
      notes?: string | null;
    }): Promise<{ error?: string }>;
    setActive(id: string, isActive: boolean): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  customers: CrudApi<PartyDto, PartyInput>;
  suppliers: CrudApi<PartyDto, PartyInput>;
  products: CrudApi<ProductDto, ProductInput>;
  routes: {
    list(): Promise<RouteDto[]>;
    create(input: RouteInput): Promise<{ error?: string }>;
    update(id: string, input: RouteInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  customerRoutes: {
    list(): Promise<CustomerRouteDto[]>;
    assign(routeId: string, customerId: string): Promise<{ error?: string }>;
    unassign(id: string): Promise<{ error?: string }>;
  };
  employees: {
    list(): Promise<EmployeeDto[]>;
    create(input: EmployeeInput): Promise<{ error?: string }>;
    update(id: string, input: EmployeeInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  salaryPayments: {
    list(): Promise<SalaryPaymentDto[]>;
    create(input: SalaryPaymentInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  income: {
    list(): Promise<IncomeDto[]>;
    create(input: IncomeInput): Promise<{ error?: string }>;
    update(id: string, input: IncomeInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  invoices: {
    list(kind: PartyKind, type: string): Promise<InvoiceDto[]>;
    listForParty(kind: PartyKind, partyId: string): Promise<InvoiceDto[]>;
    get(kind: PartyKind, id: string): Promise<InvoiceDto | null>;
    items(kind: PartyKind, invoiceId: string): Promise<InvoiceItemDto[]>;
    count(kind: PartyKind, type: string): Promise<number>;
    create(kind: PartyKind, input: InvoiceInput, items: InvoiceItemInput[], opts?: { withGatePass?: boolean }): Promise<{ error?: string; invoice?: InvoiceDto }>;
    update(kind: PartyKind, id: string, input: InvoiceInput, items: InvoiceItemInput[]): Promise<{ error?: string }>;
    delete(kind: PartyKind, id: string): Promise<{ error?: string }>;
    customerRates(customerId: string): Promise<Record<string, number>>;
    listByDate(kind: PartyKind, date: string): Promise<InvoiceDto[]>;
  };
  paymentVouchers: {
    list(): Promise<PaymentVoucherDto[]>;
    listForParty(kind: PartyKind, partyId: string): Promise<PaymentVoucherDto[]>;
    create(input: PaymentVoucherInput): Promise<{ error?: string }>;
    update(id: string, input: PaymentVoucherInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  expenseVouchers: {
    list(): Promise<ExpenseVoucherDto[]>;
    create(input: ExpenseVoucherInput): Promise<{ error?: string }>;
    update(id: string, input: ExpenseVoucherInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
  gatePasses: {
    list(): Promise<GatePassDto[]>;
    find(passDate: string, notes: string): Promise<GatePassDto | null>;
    count(): Promise<number>;
    create(input: GatePassInput): Promise<{ error?: string }>;
    update(id: string, input: GatePassInput): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
}

interface CrudApi<Dto, Input> {
  list(): Promise<Dto[]>;
  get(id: string): Promise<Dto | null>;
  create(input: Input): Promise<{ error?: string; id?: string }>;
  bulkCreate(inputs: Input[]): Promise<{ error?: string; count: number }>;
  update(id: string, input: Input): Promise<{ error?: string }>;
  delete(id: string): Promise<{ error?: string }>;
}

declare global {
  interface Window {
    api?: DistribProApi;
  }
}

function bridge(): DistribProApi {
  if (!window.api) {
    throw new Error('DistribPro desktop API not available — the SQLite build must run inside Electron.');
  }
  return window.api;
}

export const api: DistribProApi = {
  get settings() {
    return bridge().settings;
  },
  get auth() {
    return bridge().auth;
  },
  get users() {
    return bridge().users;
  },
  get permissions() {
    return bridge().permissions;
  },
  get licenses() {
    return bridge().licenses;
  },
  get customers() {
    return bridge().customers;
  },
  get suppliers() {
    return bridge().suppliers;
  },
  get products() {
    return bridge().products;
  },
  get routes() {
    return bridge().routes;
  },
  get customerRoutes() {
    return bridge().customerRoutes;
  },
  get employees() {
    return bridge().employees;
  },
  get salaryPayments() {
    return bridge().salaryPayments;
  },
  get income() {
    return bridge().income;
  },
  get invoices() {
    return bridge().invoices;
  },
  get paymentVouchers() {
    return bridge().paymentVouchers;
  },
  get expenseVouchers() {
    return bridge().expenseVouchers;
  },
  get gatePasses() {
    return bridge().gatePasses;
  },
};
