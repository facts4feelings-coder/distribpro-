/*
# Add per-item discount percentage to customer invoice items

1. Modified Tables
- `customer_invoice_items`
  - `discount_percent` (numeric, not null, default 0): per-line discount applied
    as a percentage of the line amount (qty x rate). 0 means no discount.
    The stored `total` already reflects the discounted amount.

2. Security
- No RLS changes; the table's existing policies continue to apply. The new
  column inherits the table's existing privileges.

3. Notes
- Idempotent: uses a conditional ADD COLUMN guard.
- Existing rows default to 0% discount, preserving all previous invoice totals.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_invoice_items' AND column_name = 'discount_percent'
  ) THEN
    ALTER TABLE customer_invoice_items
      ADD COLUMN discount_percent numeric NOT NULL DEFAULT 0;
  END IF;
END $$;