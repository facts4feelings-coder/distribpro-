// Offline schema: mirrors the online Supabase project table-for-table so the
// same UI code runs against a local Postgres with no server. Triggers port the
// stock auto-update and invoice status rules from the cloud migrations.

export const OFFLINE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text, address text, city text,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  balance_type text NOT NULL DEFAULT 'receivable',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text, address text, city text,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  balance_type text NOT NULL DEFAULT 'payable',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text, category text,
  unit text NOT NULL DEFAULT 'pcs',
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  day_of_week integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

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
  invoice_type text NOT NULL DEFAULT 'sale',
  payment_type text NOT NULL DEFAULT 'credit',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

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
  invoice_type text NOT NULL DEFAULT 'purchase',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text, notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT payment_vouchers_one_payee CHECK (
    (customer_id IS NOT NULL AND supplier_id IS NULL) OR
    (customer_id IS NULL AND supplier_id IS NOT NULL)
  )
);

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
  vehicle_no text, driver_name text, notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text, address text, position text,
  salary numeric(12,2) NOT NULL DEFAULT 0,
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS income_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'Other',
  reference text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salesman_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_name text NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  target_month text NOT NULL,
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (salesman_name, target_month, route_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'My Distribution Company',
  company_address text, company_phone text, company_email text,
  currency_symbol text NOT NULL DEFAULT 'Rs',
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  supplier_invoice_prefix text NOT NULL DEFAULT 'SUP-',
  payment_voucher_prefix text NOT NULL DEFAULT 'PV-',
  expense_voucher_prefix text NOT NULL DEFAULT 'EV-',
  gate_pass_prefix text NOT NULL DEFAULT 'GP-',
  sales_return_prefix text NOT NULL DEFAULT 'SR-',
  purchase_return_prefix text NOT NULL DEFAULT 'PR-',
  default_print_format text NOT NULL DEFAULT 'a4',
  thermal_printer_width text NOT NULL DEFAULT '80mm',
  invoice_footer_note text NOT NULL DEFAULT 'Thank you for your business!',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id uuid PRIMARY KEY,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'download',
  file_name text,
  size_bytes integer,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  max_devices int NOT NULL DEFAULT 1,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text,
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text,
  password_hash text NOT NULL,
  salt text NOT NULL,
  recovery_question text,
  recovery_answer_hash text,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer_id ON customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_date ON customer_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_customer_id ON payment_vouchers(customer_id);
CREATE INDEX IF NOT EXISTS idx_expense_vouchers_date ON expense_vouchers(expense_date);
CREATE INDEX IF NOT EXISTS idx_gate_passes_date ON gate_passes(pass_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);

CREATE OR REPLACE FUNCTION adjust_stock_on_invoice_item() RETURNS trigger AS $$
DECLARE
  v_delta numeric;
  v_doc_type text;
BEGIN
  IF TG_TABLE_NAME = 'customer_invoice_items' THEN
    IF TG_OP = 'DELETE' THEN v_delta := OLD.quantity; ELSE v_delta := NEW.quantity; END IF;
    SELECT invoice_type INTO v_doc_type FROM customer_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_doc_type = 'sale' THEN v_delta := -v_delta;
    ELSIF v_doc_type <> 'sales_return' THEN RETURN NULL; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN v_delta := OLD.quantity; ELSE v_delta := NEW.quantity; END IF;
    SELECT invoice_type INTO v_doc_type FROM supplier_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_doc_type = 'purchase_return' THEN v_delta := -v_delta;
    ELSIF v_doc_type <> 'purchase' THEN RETURN NULL; END IF;
  END IF;
  IF COALESCE(NEW.product_id, OLD.product_id) IS NULL THEN RETURN NULL; END IF;
  UPDATE products SET stock_quantity = stock_quantity + v_delta WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_customer_invoice_items ON customer_invoice_items;
CREATE TRIGGER trg_stock_customer_invoice_items AFTER INSERT OR UPDATE OR DELETE ON customer_invoice_items
  FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_invoice_item();
DROP TRIGGER IF EXISTS trg_stock_supplier_invoice_items ON supplier_invoice_items;
CREATE TRIGGER trg_stock_supplier_invoice_items AFTER INSERT OR UPDATE OR DELETE ON supplier_invoice_items
  FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_invoice_item();

CREATE OR REPLACE FUNCTION sync_invoice_status() RETURNS trigger AS $$
BEGIN
  IF NEW.balance IS NOT NULL AND NEW.balance <= 0 THEN NEW.status := 'paid';
  ELSE NEW.status := 'unpaid'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_customer_invoices ON customer_invoices;
CREATE TRIGGER trg_status_customer_invoices BEFORE INSERT OR UPDATE ON customer_invoices
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_status();
DROP TRIGGER IF EXISTS trg_status_supplier_invoices ON supplier_invoices;
CREATE TRIGGER trg_status_supplier_invoices BEFORE INSERT OR UPDATE ON supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_status();
`;

export const OFFLINE_SEED_SQL = `
INSERT INTO settings (
  id, company_name, company_address, company_phone, currency_symbol,
  invoice_prefix, supplier_invoice_prefix, payment_voucher_prefix, expense_voucher_prefix, gate_pass_prefix
) VALUES (
  gen_random_uuid(), 'My Distribution Company', '', '', 'Rs',
  'INV-', 'SUP-', 'PV-', 'EV-', 'GP-'
);

-- Default first admin (username: admin, password: admin123).
-- Salt 'distribpro-default', hash = sha256('distribpro-default:admin123').
-- Change the password from Settings after first login.
INSERT INTO app_users (username, password_hash, salt)
SELECT 'admin', '4ce1cbe16d4601c196baa607eabc8712674757873c0364bfbefbdc4cfc36e4b7', 'distribpro-default'
WHERE NOT EXISTS (SELECT 1 FROM app_users);
`;
