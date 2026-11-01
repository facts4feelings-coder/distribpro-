// DistribPro — SQLite schema (Drizzle ORM)
// Translated table-for-table from src/lib/offlineSchema.ts (Postgres/PGlite).
// Unit rules live in migration/DECISIONS.md:
//   money   -> integer paisa (Rs x 100)          [D2]
//   quantity-> integer milli-units (x 1000)      [D3]
//   percent -> integer x 100 (10.5% = 1050)      [D4]
//   uuid -> text PK, date/timestamptz -> text ISO, boolean -> integer boolean [D5]
import { sqliteTable, text, integer, index, unique, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => text('created_at').$defaultFn(() => new Date().toISOString());
const today = () => new Date().toISOString().slice(0, 10);

export const customers = sqliteTable('customers', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  openingBalance: integer('opening_balance').notNull().default(0), // paisa
  currentBalance: integer('current_balance').notNull().default(0), // paisa
  balanceType: text('balance_type').notNull().default('receivable'),
  createdAt: createdAt(),
});

export const suppliers = sqliteTable('suppliers', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  openingBalance: integer('opening_balance').notNull().default(0), // paisa
  currentBalance: integer('current_balance').notNull().default(0), // paisa
  balanceType: text('balance_type').notNull().default('payable'),
  createdAt: createdAt(),
});

export const products = sqliteTable('products', {
  id: id(),
  name: text('name').notNull(),
  sku: text('sku'),
  category: text('category'),
  unit: text('unit').notNull().default('pcs'),
  purchasePrice: integer('purchase_price').notNull().default(0), // paisa
  salePrice: integer('sale_price').notNull().default(0), // paisa
  stockQuantity: integer('stock_quantity').notNull().default(0), // milli-units
  reorderLevel: integer('reorder_level').notNull().default(0), // milli-units
  createdAt: createdAt(),
});

export const routes = sqliteTable('routes', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  dayOfWeek: integer('day_of_week').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const customerRoutes = sqliteTable('customer_routes', {
  id: id(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  routeId: text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

export const customerInvoices = sqliteTable('customer_invoices', {
  id: id(),
  invoiceNo: text('invoice_no').notNull(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  invoiceDate: text('invoice_date').notNull().$defaultFn(today),
  dueDate: text('due_date'),
  subtotal: integer('subtotal').notNull().default(0), // paisa
  discount: integer('discount').notNull().default(0), // paisa
  tax: integer('tax').notNull().default(0), // paisa
  total: integer('total').notNull().default(0), // paisa
  paidAmount: integer('paid_amount').notNull().default(0), // paisa
  balance: integer('balance').notNull().default(0), // paisa
  status: text('status').notNull().default('unpaid'),
  invoiceType: text('invoice_type').notNull().default('sale'),
  paymentType: text('payment_type').notNull().default('credit'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_customer_invoices_customer_id').on(t.customerId),
  index('idx_customer_invoices_date').on(t.invoiceDate),
]);

export const customerInvoiceItems = sqliteTable('customer_invoice_items', {
  id: id(),
  invoiceId: text('invoice_id').notNull().references(() => customerInvoices.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull().default(1000), // milli-units (old default 1)
  unitPrice: integer('unit_price').notNull().default(0), // paisa
  discountPercent: integer('discount_percent').notNull().default(0), // percent x100
  total: integer('total').notNull().default(0), // paisa
  createdAt: createdAt(),
});

export const supplierInvoices = sqliteTable('supplier_invoices', {
  id: id(),
  invoiceNo: text('invoice_no').notNull(),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  invoiceDate: text('invoice_date').notNull().$defaultFn(today),
  dueDate: text('due_date'),
  subtotal: integer('subtotal').notNull().default(0),
  discount: integer('discount').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull().default(0),
  paidAmount: integer('paid_amount').notNull().default(0),
  balance: integer('balance').notNull().default(0),
  status: text('status').notNull().default('unpaid'),
  invoiceType: text('invoice_type').notNull().default('purchase'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_supplier_invoices_supplier_id').on(t.supplierId),
]);

export const supplierInvoiceItems = sqliteTable('supplier_invoice_items', {
  id: id(),
  invoiceId: text('invoice_id').notNull().references(() => supplierInvoices.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull().default(1000),
  unitPrice: integer('unit_price').notNull().default(0),
  discountPercent: integer('discount_percent').notNull().default(0),
  total: integer('total').notNull().default(0),
  createdAt: createdAt(),
});

export const paymentVouchers = sqliteTable('payment_vouchers', {
  id: id(),
  voucherNo: text('voucher_no').notNull(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'restrict' }),
  voucherDate: text('voucher_date').notNull().$defaultFn(today),
  amount: integer('amount').notNull().default(0), // paisa
  paymentMethod: text('payment_method').notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_payment_vouchers_customer_id').on(t.customerId),
  check('payment_vouchers_one_payee', sql`(${t.customerId} IS NOT NULL AND ${t.supplierId} IS NULL) OR (${t.customerId} IS NULL AND ${t.supplierId} IS NOT NULL)`),
]);

export const expenseVouchers = sqliteTable('expense_vouchers', {
  id: id(),
  voucherNo: text('voucher_no').notNull(),
  expenseDate: text('expense_date').notNull().$defaultFn(today),
  category: text('category').notNull(),
  description: text('description'),
  amount: integer('amount').notNull().default(0), // paisa
  paidTo: text('paid_to'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_expense_vouchers_date').on(t.expenseDate),
]);

export const gatePasses = sqliteTable('gate_passes', {
  id: id(),
  passNo: text('pass_no').notNull(),
  passType: text('pass_type').notNull().default('sales'),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  passDate: text('pass_date').notNull().$defaultFn(today),
  referenceInvoice: text('reference_invoice'),
  itemsDescription: text('items_description'),
  totalAmount: integer('total_amount').notNull().default(0), // paisa
  vehicleNo: text('vehicle_no'),
  driverName: text('driver_name'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_gate_passes_date').on(t.passDate),
]);

export const employees = sqliteTable('employees', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  position: text('position'),
  salary: integer('salary').notNull().default(0), // paisa
  hireDate: text('hire_date').$defaultFn(today),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
});

export const salaryPayments = sqliteTable('salary_payments', {
  id: id(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  paymentDate: text('payment_date').notNull().$defaultFn(today),
  amount: integer('amount').notNull().default(0), // paisa
  month: text('month').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [
  index('idx_salary_payments_employee').on(t.employeeId),
]);

export const incomeOptions = sqliteTable('income_options', {
  id: id(),
  description: text('description').notNull(),
  amount: integer('amount').notNull().default(0), // paisa
  incomeDate: text('income_date').notNull().$defaultFn(today),
  category: text('category').notNull().default('Other'),
  reference: text('reference'),
  createdAt: createdAt(),
});

export const salesmanTargets = sqliteTable('salesman_targets', {
  id: id(),
  salesmanName: text('salesman_name').notNull(),
  routeId: text('route_id').references(() => routes.id, { onDelete: 'cascade' }),
  targetMonth: text('target_month').notNull(),
  targetAmount: integer('target_amount').notNull().default(0), // paisa
  createdAt: createdAt(),
}, (t) => [
  unique('uq_salesman_targets').on(t.salesmanName, t.targetMonth, t.routeId),
]);

export const settings = sqliteTable('settings', {
  id: id(),
  companyName: text('company_name').notNull().default('My Distribution Company'),
  companyAddress: text('company_address'),
  companyPhone: text('company_phone'),
  companyEmail: text('company_email'),
  currencySymbol: text('currency_symbol').notNull().default('Rs'),
  taxRate: integer('tax_rate').notNull().default(0), // percent x100
  invoicePrefix: text('invoice_prefix').notNull().default('INV-'),
  supplierInvoicePrefix: text('supplier_invoice_prefix').notNull().default('SUP-'),
  paymentVoucherPrefix: text('payment_voucher_prefix').notNull().default('PV-'),
  expenseVoucherPrefix: text('expense_voucher_prefix').notNull().default('EV-'),
  gatePassPrefix: text('gate_pass_prefix').notNull().default('GP-'),
  salesReturnPrefix: text('sales_return_prefix').notNull().default('SR-'),
  purchaseReturnPrefix: text('purchase_return_prefix').notNull().default('PR-'),
  defaultPrintFormat: text('default_print_format').notNull().default('a4'),
  thermalPrinterWidth: text('thermal_printer_width').notNull().default('80mm'),
  invoiceFooterNote: text('invoice_footer_note').notNull().default('Thank you for your business!'),
  createdAt: createdAt(),
});

export const userPermissions = sqliteTable('user_permissions', {
  userId: text('user_id').primaryKey(),
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull().default([]),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const backupHistory = sqliteTable('backup_history', {
  id: id(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  kind: text('kind').notNull().default('download'),
  fileName: text('file_name'),
  sizeBytes: integer('size_bytes'),
  tableCounts: text('table_counts', { mode: 'json' }).$type<Record<string, number>>().notNull().default({}),
});

export const licenses = sqliteTable('licenses', {
  id: id(),
  licenseKey: text('license_key').notNull().unique(),
  customerName: text('customer_name').notNull().default(''),
  maxDevices: integer('max_devices').notNull().default(1),
  expiresAt: text('expires_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const activations = sqliteTable('activations', {
  id: id(),
  licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name'),
  activatedAt: text('activated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const appUsers = sqliteTable('app_users', {
  id: id(),
  username: text('username').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  recoveryQuestion: text('recovery_question'),
  recoveryAnswerHash: text('recovery_answer_hash'),
  lastLogin: text('last_login'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
