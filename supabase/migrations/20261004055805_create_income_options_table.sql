/*
# Create income_options table for tracking other income sources

1. New Tables
- `income_options`
  - `id` (uuid, primary key)
  - `description` (text, not null) — what the income was for
  - `amount` (numeric, not null) — income amount
  - `income_date` (date, not null) — when the income was received
  - `category` (text, not null) — e.g. Commission, Rent, Interest, Other
  - `reference` (text, nullable) — optional reference number
  - `created_at` (timestamp)

2. Security
- Enable RLS on `income_options`.
- This is a single-tenant app (has auth but all data shared) — allow anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS income_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'Other',
  reference text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE income_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_income_options" ON income_options;
CREATE POLICY "anon_select_income_options" ON income_options FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_income_options" ON income_options;
CREATE POLICY "anon_insert_income_options" ON income_options FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_income_options" ON income_options;
CREATE POLICY "anon_update_income_options" ON income_options FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_income_options" ON income_options;
CREATE POLICY "anon_delete_income_options" ON income_options FOR DELETE
TO anon, authenticated USING (true);
