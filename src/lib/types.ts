export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  opening_balance: number;
  current_balance: number;
  balance_type: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  opening_balance: number;
  current_balance: number;
  balance_type: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  reorder_level: number;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  sort_order: number;
  created_at: string;
}

export interface CustomerRoute {
  id: string;
  customer_id: string;
  route_id: string;
  created_at: string;
}

export interface CustomerInvoice {
  id: string;
  invoice_no: string;
  customer_id: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance: number;
  status: string;
  payment_type?: string;
  notes: string | null;
  invoice_type: string;
  created_at: string;
}

export interface CustomerInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total: number;
  created_at: string;
}

export interface SupplierInvoice {
  id: string;
  invoice_no: string;
  supplier_id: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance: number;
  status: string;
  notes: string | null;
  invoice_type: string;
  created_at: string;
}

export interface SupplierInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total: number;
  created_at: string;
}

export interface PaymentVoucher {
  id: string;
  voucher_no: string;
  customer_id: string | null;
  supplier_id?: string | null;
  voucher_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ExpenseVoucher {
  id: string;
  voucher_no: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  paid_to: string | null;
  created_at: string;
}

export interface GatePass {
  id: string;
  pass_no: string;
  pass_type: string;
  customer_id: string | null;
  customer_name: string;
  pass_date: string;
  reference_invoice: string | null;
  items_description: string | null;
  total_amount: number;
  vehicle_no: string | null;
  driver_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  position: string | null;
  salary: number;
  hire_date: string;
  is_active: boolean;
  created_at: string;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  payment_date: string;
  amount: number;
  month: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  company_name: string;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  currency_symbol: string;
  tax_rate: number;
  invoice_prefix: string;
  supplier_invoice_prefix: string;
  payment_voucher_prefix: string;
  expense_voucher_prefix: string;
  gate_pass_prefix: string;
  sales_return_prefix: string;
  purchase_return_prefix: string;
  default_print_format: string;
  thermal_printer_width: string;
  invoice_footer_note?: string | null;
}

export interface IncomeOption {
  id: string;
  description: string;
  amount: number;
  income_date: string;
  category: string;
  reference: string | null;
  created_at: string;
}

export interface CustomerWithRoute extends Customer {
  routes?: Route[];
}

export interface InvoiceWithCustomer extends CustomerInvoice {
  customers?: Customer;
}
export interface InvoiceWithSupplier extends SupplierInvoice {
  suppliers?: Supplier;
}

export interface PaymentVoucherWithCustomer extends PaymentVoucher {
  customers?: Customer;
  suppliers?: Supplier;
}

export interface SalaryPaymentWithEmployee extends SalaryPayment {
  employees?: Employee;
}
