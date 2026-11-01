/*
# Add payment type to customer invoices

1. Purpose
   Quick Sale needs to record whether a sale was settled in Cash (fully paid at
   the counter) or on Credit (payment to be collected later, possibly partial).

2. Changes
   - `customer_invoices` gains a `payment_type` column (text, 'cash' or 'credit',
     defaults to 'credit' so existing rows behave as before).
   - No RLS changes.

3. Notes
   - Cash sales should have balance <= 0 (status auto-set to 'paid' by the
     existing status trigger).
*/

ALTER TABLE customer_invoices ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'credit';