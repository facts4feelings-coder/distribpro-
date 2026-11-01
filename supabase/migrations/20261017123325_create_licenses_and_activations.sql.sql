/*
# License system: licenses table + app-lock state

1. New Table
- `licenses`: one row per license key issued by the owner.
  - `id` (uuid, primary key)
  - `license_key` (text, unique, not null) — full key, e.g. DIST-XXXX-XXXX-XXXX-XXXX
  - `customer_name` (text) — who the key was issued to (label for the owner)
  - `max_devices` (int, default 1) — how many devices may activate this key
  - `expires_at` (timestamptz, nullable) — when the license lapses; null = lifetime
  - `is_active` (boolean, default true) — owner can disable a leaked key
  - `notes` (text, nullable)
  - `created_at`, `updated_at` (timestamps)

2. New Table
- `activations`: one row per device that activated a key.
  - `id` (uuid, primary key)
  - `license_id` (uuid, references licenses.id)
  - `device_id` (text, not null) — fingerprint generated on the device
  - `device_name` (text)
  - `activated_at` (timestamp)
  - Unique on (license_id, device_id) so re-activating the same device is idempotent.

3. Purpose
- The owner generates keys in the app (Key Generator in Settings).
- End-user devices activate offline: the key itself is a self-verifying signed code, so no internet is needed to activate. The licenses table lets the owner issue/revoke keys centrally, and the next time an online device syncs it can re-check revocation.

4. Security
- RLS enabled on both tables.
- licenses/activations: SELECT restricted to authenticated users (admin sees the key list in Settings). INSERT/UPDATE/DELETE restricted to authenticated users as this is an internal admin table; anon cannot read keys.
*/

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
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (license_id, device_id)
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_licenses" ON licenses;
CREATE POLICY "auth_select_licenses" ON licenses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_licenses" ON licenses;
CREATE POLICY "auth_insert_licenses" ON licenses FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_licenses" ON licenses;
CREATE POLICY "auth_update_licenses" ON licenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_licenses" ON licenses;
CREATE POLICY "auth_delete_licenses" ON licenses FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_select_activations" ON activations;
CREATE POLICY "auth_select_activations" ON activations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_activations" ON activations;
CREATE POLICY "auth_insert_activations" ON activations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_activations" ON activations;
CREATE POLICY "auth_delete_activations" ON activations FOR DELETE TO authenticated USING (true);
