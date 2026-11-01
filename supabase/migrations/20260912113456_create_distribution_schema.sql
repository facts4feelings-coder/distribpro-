/*
# Distribution Management System - Core Schema

1. Purpose
   Full-featured distribution management system for managing customers, suppliers,
   products, invoices, ledgers, routes, payment vouchers, expense vouchers, gate passes,
   employee salaries, and admin settings.

2. New Tables
   - `customers` — customer master data with ledger balance
   - `suppliers` — supplier master data with ledger balance
   - `products` — product/stock master with quantity and pricing
   - `routes` — 6 delivery routes assigned across a 7-day schedule
   - `customer_routes` — maps customers to routes/days
   - `customer_invoices` — sales invoices for customers (editable, date-changeable)
   - `customer_invoice_items` — line items on a customer invoice
   - `supplier_invoices` — purchase invoices from suppliers (editable, date-changeable)
   - `supplier_invoice_items` — line items on a supplier invoice
   - `payment_vouchers` — daily payment recovery vouchers
   - `expense_vouchers` — daily expense vouchers
   - `gate_passes` — gate passes for bills cut and sales made (in customer names)
   - `employees` — employee master data
   - `salary_payments` — employee salary payment records
   - `settings` — admin settings (company info, printer config, etc.)

3. Security
   - Admin login required (auth-based). All policies scoped to `authenticated`.
   - Owner column defaults to `auth.uid()` where applicable.
   - RLS enabled on all tables.
*/

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  city text,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  balance_type text NOT NULL DEFAULT 'receivable',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customers" ON customers;
CREATE POLICY "select_customers" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customers" ON customers;
CREATE POLICY "insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_customers" ON customers;
CREATE POLICY "update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_customers" ON customers;
CREATE POLICY "delete_customers" ON customers FOR DELETE TO authenticated USING (true);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  city text,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  balance_type text NOT NULL DEFAULT 'payable',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_suppliers" ON suppliers;
CREATE POLICY "select_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_suppliers" ON suppliers;
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_suppliers" ON suppliers;
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_suppliers" ON suppliers;
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  category text,
  unit text NOT NULL DEFAULT 'pcs',
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

-- Routes (6 routes across 7-day schedule)
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  day_of_week integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_routes" ON routes;
CREATE POLICY "select_routes" ON routes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_routes" ON routes;
CREATE POLICY "insert_routes" ON routes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_routes" ON routes;
CREATE POLICY "update_routes" ON routes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_routes" ON routes;
CREATE POLICY "delete_routes" ON routes FOR DELETE TO authenticated USING (true);

-- Customer-Route mapping
CREATE TABLE IF NOT EXISTS customer_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customer_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customer_routes" ON customer_routes;
CREATE POLICY "select_customer_routes" ON customer_routes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customer_routes" ON customer_routes;
CREATE POLICY "insert_customer_routes" ON customer_routes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_customer_routes" ON customer_routes;
CREATE POLICY "update_customer_routes" ON customer_routes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_customer_routes" ON customer_routes;
CREATE POLICY "delete_customer_routes" ON customer_routes FOR DELETE TO authenticated USING (true);

-- Customer invoices
CREATE TABLE IF NOT EXISTS customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customer_invoices" ON customer_invoices;
CREATE POLICY "select_customer_invoices" ON customer_invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customer_invoices" ON customer_invoices;
CREATE POLICY "insert_customer_invoices" ON customer_invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_customer_invoices" ON customer_invoices;
CREATE POLICY "update_customer_invoices" ON customer_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_customer_invoices" ON customer_invoices;
CREATE POLICY "delete_customer_invoices" ON customer_invoices FOR DELETE TO authenticated USING (true);

-- Customer invoice items
CREATE TABLE IF NOT EXISTS customer_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customer_invoice_items" ON customer_invoice_items;
CREATE POLICY "select_customer_invoice_items" ON customer_invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customer_invoice_items" ON customer_invoice_items;
CREATE POLICY "insert_customer_invoice_items" ON customer_invoice_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_customer_invoice_items" ON customer_invoice_items;
CREATE POLICY "update_customer_invoice_items" ON customer_invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_customer_invoice_items" ON customer_invoice_items;
CREATE POLICY "delete_customer_invoice_items" ON customer_invoice_items FOR DELETE TO authenticated USING (true);

-- Supplier invoices
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_supplier_invoices" ON supplier_invoices;
CREATE POLICY "select_supplier_invoices" ON supplier_invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_supplier_invoices" ON supplier_invoices;
CREATE POLICY "insert_supplier_invoices" ON supplier_invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_supplier_invoices" ON supplier_invoices;
CREATE POLICY "update_supplier_invoices" ON supplier_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_supplier_invoices" ON supplier_invoices;
CREATE POLICY "delete_supplier_invoices" ON supplier_invoices FOR DELETE TO authenticated USING (true);

-- Supplier invoice items
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supplier_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_supplier_invoice_items" ON supplier_invoice_items;
CREATE POLICY "select_supplier_invoice_items" ON supplier_invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_supplier_invoice_items" ON supplier_invoice_items;
CREATE POLICY "insert_supplier_invoice_items" ON supplier_invoice_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_supplier_invoice_items" ON supplier_invoice_items;
CREATE POLICY "update_supplier_invoice_items" ON supplier_invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_supplier_invoice_items" ON supplier_invoice_items;
CREATE POLICY "delete_supplier_invoice_items" ON supplier_invoice_items FOR DELETE TO authenticated USING (true);

-- Payment recovery vouchers
CREATE TABLE IF NOT EXISTS payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payment_vouchers" ON payment_vouchers;
CREATE POLICY "select_payment_vouchers" ON payment_vouchers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_payment_vouchers" ON payment_vouchers;
CREATE POLICY "insert_payment_vouchers" ON payment_vouchers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_payment_vouchers" ON payment_vouchers;
CREATE POLICY "update_payment_vouchers" ON payment_vouchers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_payment_vouchers" ON payment_vouchers;
CREATE POLICY "delete_payment_vouchers" ON payment_vouchers FOR DELETE TO authenticated USING (true);

-- Expense vouchers
CREATE TABLE IF NOT EXISTS expense_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_to text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expense_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_expense_vouchers" ON expense_vouchers;
CREATE POLICY "select_expense_vouchers" ON expense_vouchers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_expense_vouchers" ON expense_vouchers;
CREATE POLICY "insert_expense_vouchers" ON expense_vouchers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_expense_vouchers" ON expense_vouchers;
CREATE POLICY "update_expense_vouchers" ON expense_vouchers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_expense_vouchers" ON expense_vouchers;
CREATE POLICY "delete_expense_vouchers" ON expense_vouchers FOR DELETE TO authenticated USING (true);

-- Gate passes (for bills cut and sales made, in customer names)
CREATE TABLE IF NOT EXISTS gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_no text NOT NULL,
  pass_type text NOT NULL DEFAULT 'sales',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  pass_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_invoice text,
  items_description text,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  vehicle_no text,
  driver_name text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_gate_passes" ON gate_passes;
CREATE POLICY "select_gate_passes" ON gate_passes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_gate_passes" ON gate_passes;
CREATE POLICY "insert_gate_passes" ON gate_passes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_gate_passes" ON gate_passes;
CREATE POLICY "update_gate_passes" ON gate_passes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_gate_passes" ON gate_passes;
CREATE POLICY "delete_gate_passes" ON gate_passes FOR DELETE TO authenticated USING (true);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  position text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_employees" ON employees;
CREATE POLICY "select_employees" ON employees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_employees" ON employees;
CREATE POLICY "insert_employees" ON employees FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_employees" ON employees;
CREATE POLICY "update_employees" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_employees" ON employees;
CREATE POLICY "delete_employees" ON employees FOR DELETE TO authenticated USING (true);

-- Salary payments
CREATE TABLE IF NOT EXISTS salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  month text NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_salary_payments" ON salary_payments;
CREATE POLICY "select_salary_payments" ON salary_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_salary_payments" ON salary_payments;
CREATE POLICY "insert_salary_payments" ON salary_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_salary_payments" ON salary_payments;
CREATE POLICY "update_salary_payments" ON salary_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_salary_payments" ON salary_payments;
CREATE POLICY "delete_salary_payments" ON salary_payments FOR DELETE TO authenticated USING (true);

-- Settings (single-row admin settings)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'My Distribution Company',
  company_address text,
  company_phone text,
  company_email text,
  currency_symbol text NOT NULL DEFAULT 'Rs',
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  supplier_invoice_prefix text NOT NULL DEFAULT 'SUP-',
  payment_voucher_prefix text NOT NULL DEFAULT 'PV-',
  expense_voucher_prefix text NOT NULL DEFAULT 'EV-',
  gate_pass_prefix text NOT NULL DEFAULT 'GP-',
  default_print_format text NOT NULL DEFAULT 'a4',
  thermal_printer_width text NOT NULL DEFAULT '80mm',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_settings" ON settings;
CREATE POLICY "insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_settings" ON settings;
CREATE POLICY "delete_settings" ON settings FOR DELETE TO authenticated USING (true);

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer_id ON customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_date ON customer_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_customer_id ON payment_vouchers(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_date ON payment_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_date ON expense_vouchers(expense_date);
CREATE INDEX IF NOT EXISTS idx_gate_passes_date ON gate_passes(pass_date);
CREATE INDEX IF NOT EXISTS idx_customer_routes_customer ON customer_routes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_routes_route ON customer_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
