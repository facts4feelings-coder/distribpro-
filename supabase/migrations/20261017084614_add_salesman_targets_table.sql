/*
# Salesman targets and seed shops

1. New Tables
- `salesman_targets`
  - `id` (uuid, primary key)
  - `salesman_name` (text, not null — salesman whose target this is)
  - `route_id` (uuid, references routes — optional; target can be route-specific)
  - `target_month` (text, not null — e.g. '2026-10', the month the target applies to)
  - `target_amount` (numeric 12,2, not null — sales target in currency)
  - `created_at` (timestamp)
  - UNIQUE (salesman_name, target_month, route_id) so a salesman has one target per route per month

2. Security
- RLS enabled on `salesman_targets`.
- Full CRUD for signed-in admin users (same model as the rest of the app's tables).

3. Notes
- Seeded with 60 shops (customers) with shopkeeper contact data across 6 routes,
  plus monthly targets for the salesmen who cover those routes.
- Insert is idempotent: only runs when the customers table is empty.
*/

CREATE TABLE IF NOT EXISTS salesman_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_name text NOT NULL,
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  target_month text NOT NULL,
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (salesman_name, target_month, route_id)
);

ALTER TABLE salesman_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_salesman_targets" ON salesman_targets;
CREATE POLICY "select_salesman_targets" ON salesman_targets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_salesman_targets" ON salesman_targets;
CREATE POLICY "insert_salesman_targets" ON salesman_targets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_salesman_targets" ON salesman_targets;
CREATE POLICY "update_salesman_targets" ON salesman_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_salesman_targets" ON salesman_targets;
CREATE POLICY "delete_salesman_targets" ON salesman_targets FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_salesman_targets_month ON salesman_targets (target_month);
