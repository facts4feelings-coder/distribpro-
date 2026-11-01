/*
# Add invoice_type column and return prefixes

1. Changes to customer_invoices
   - Add `invoice_type` text column, default 'sale'.
     Values: 'sale' (normal sales invoice), 'sales-return' (customer returning goods).
   - Add index on invoice_type for filtering.

2. Changes to supplier_invoices
   - Add `invoice_type` text column, default 'purchase'.
     Values: 'purchase' (normal purchase invoice), 'purchase-return' (returning goods to supplier).
   - Add index on invoice_type for filtering.

3. Changes to settings
   - Add `sales_return_prefix` text, default 'SR-'.
   - Add `purchase_return_prefix` text, default 'PR-'.

4. Security
   - No new tables. Existing RLS policies already cover all CRUD on these tables.
   - New columns inherit existing policies (RLS is table-level, not column-level).

5. Notes
   - Existing rows get the default value ('sale' / 'purchase') automatically.
   - The app will filter customer_invoices by invoice_type='sale' on the main
     Customer Invoices page, and invoice_type='sales-return' on the Sales Returns page.
   - Same for supplier_invoices: 'purchase' vs 'purchase-return'.
*/

-- Add invoice_type to customer_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_invoices' AND column_name = 'invoice_type'
  ) THEN
    ALTER TABLE customer_invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'sale';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_type ON customer_invoices(invoice_type);

-- Add invoice_type to supplier_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_invoices' AND column_name = 'invoice_type'
  ) THEN
    ALTER TABLE supplier_invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'purchase';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_type ON supplier_invoices(invoice_type);

-- Add return prefixes to settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'sales_return_prefix'
  ) THEN
    ALTER TABLE settings ADD COLUMN sales_return_prefix text NOT NULL DEFAULT 'SR-';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'purchase_return_prefix'
  ) THEN
    ALTER TABLE settings ADD COLUMN purchase_return_prefix text NOT NULL DEFAULT 'PR-';
  END IF;
END $$;