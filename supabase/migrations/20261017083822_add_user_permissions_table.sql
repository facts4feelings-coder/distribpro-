/*
# Add per-user permission restrictions for admin accounts

1. New Tables
- `user_permissions`
  - `user_id` (uuid, primary key, references auth.users, deleted with the user)
  - `permissions` (text array — list of page/module keys the user may access; an empty array or a missing row means FULL access)
  - `updated_at` (timestamp, last change time)

2. Security
- RLS enabled on `user_permissions`.
- SELECT policy: any signed-in user can read permission rows (needed to render menus and the settings list).
- NO insert/update/delete policies: regular users can never change permissions from the browser.
  Permission rows are written only by the `create-admin-user` edge function using the service role.

3. Notes
- Users without a row in this table keep unrestricted (full) access, so existing
  admin accounts are unaffected.
*/

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_user_permissions" ON user_permissions;

CREATE POLICY "authenticated_read_user_permissions"
ON user_permissions FOR SELECT
TO authenticated
USING (true);
