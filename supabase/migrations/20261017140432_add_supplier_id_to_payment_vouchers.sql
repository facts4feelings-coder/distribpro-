/*
# Allow payments to suppliers in payment_vouchers

1. Modified Tables
- `payment_vouchers`
  - `customer_id` is now nullable (a payment can target a supplier instead)
  - new column `supplier_id` (uuid, nullable) referencing `suppliers(id)`
  - new CHECK constraint: every voucher must have exactly one payee
    (customer_id set, or supplier_id set — never both, never neither)

2. Security
- No RLS changes; existing table policies keep applying.

3. Notes
- Existing customer vouchers keep working unchanged.
- Supplier payments will be applied to open supplier purchase invoices
  by the app, same as customer payments are applied to sale invoices.
*/

ALTER TABLE payment_vouchers ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE payment_vouchers
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_vouchers_one_payee'
  ) THEN
    ALTER TABLE payment_vouchers ADD CONSTRAINT payment_vouchers_one_payee
      CHECK (
        (customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (customer_id IS NULL AND supplier_id IS NOT NULL)
      );
  END IF;
END $$;