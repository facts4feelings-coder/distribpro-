/*
# Add editable invoice footer note to settings

1. Modified Tables
- `settings`: add `invoice_footer_note` (text, nullable). When empty, no footer note is shown on printed invoices. A default of 'Thank you for your business!' is applied to existing rows so nothing breaks.

2. Purpose
- Lets the user customize the note printed at the bottom of invoices/sales returns/purchase invoices from the Settings page.

3. Security
- No RLS changes; the settings table keeps its existing policies.
*/

ALTER TABLE settings ADD COLUMN IF NOT EXISTS invoice_footer_note text NOT NULL DEFAULT 'Thank you for your business!';
