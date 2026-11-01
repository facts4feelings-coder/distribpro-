/*
# Auto invoice status from balance

1. Purpose
   Invoice status (paid/unpaid) should update automatically whenever the
   outstanding balance changes, so a bill becomes "paid" as soon as it is fully
   settled — regardless of which screen caused the change.

2. Changes
   - Adds trigger function `sync_invoice_status()` that runs BEFORE INSERT or UPDATE
     on customer_invoices and supplier_invoices.
   - Sets status = 'paid' when balance <= 0, otherwise 'unpaid'.
   - Existing app code already computes this; the trigger guarantees consistency
     for all current and future code paths (including direct database updates).

3. Security
   - No RLS changes; triggers run as the table owner.

4. Notes
   - New rows default to 'unpaid' in the schema; the trigger corrects them at insert.
*/

CREATE OR REPLACE FUNCTION sync_invoice_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.balance IS NOT NULL AND NEW.balance <= 0 THEN
    NEW.status := 'paid';
  ELSE
    NEW.status := 'unpaid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_customer_invoices ON customer_invoices;
CREATE TRIGGER trg_status_customer_invoices
BEFORE INSERT OR UPDATE ON customer_invoices
FOR EACH ROW EXECUTE FUNCTION sync_invoice_status();

DROP TRIGGER IF EXISTS trg_status_supplier_invoices ON supplier_invoices;
CREATE TRIGGER trg_status_supplier_invoices
BEFORE INSERT OR UPDATE ON supplier_invoices
FOR EACH ROW EXECUTE FUNCTION sync_invoice_status();