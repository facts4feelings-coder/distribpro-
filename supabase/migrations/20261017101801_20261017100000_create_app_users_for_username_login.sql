/*
# Username-based login support

1. Plain-English explanation
- The app currently signs people in with EMAIL + password through Supabase Auth.
- The owner wants USERNAME + password login instead (no email on the login screen).
- Supabase Auth requires an email per user, so we keep using Supabase Auth under the
  hood but add a username mapping table. Login flows: user types a username, we look
  up the matching email in `app_users`, then sign in with that email + password.
- IMPORTANT: users created BEFORE this change (existing admins) get their username
  derived automatically from the part of their email before the "@", so nothing
  breaks for them.

2. New Tables
- `app_users`
  - `id` (uuid, primary key, references auth.users, deleted with the user)
  - `username` (text, unique, not null, case-insensitive via lowercase index)
  - `email` (text, not null — the hidden Supabase auth email used under the hood)
  - `created_at` (timestamp)

3. Security
- RLS enabled on `app_users`.
- SELECT policy: any signed-in user can list usernames (needed for the settings
  user-management screen). Username + email are not secrets for signed-in staff.
- NO insert/update/delete policies from the browser: rows are created only by the
  `create-admin-user` edge function using the service role.

4. Notes
- A trigger backfills usernames for users created directly through the Supabase
  dashboard (e.g. the very first admin), deriving from the email prefix.
- Login itself is done by a `login-username` edge function so the username→email
  lookup cannot leak the email list to anonymous callers.
*/

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx ON app_users (lower(username));

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_app_users" ON app_users;

CREATE POLICY "authenticated_read_app_users"
ON app_users FOR SELECT
TO authenticated
USING (true);

-- Backfill: one row per existing auth user, username derived from email prefix.
INSERT INTO app_users (id, username, email)
SELECT u.id,
  COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'user_' || left(replace(u.id::text, '-', ''), 8)),
  u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM app_users a WHERE a.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Keep app_users in sync for users created outside the edge function.
CREATE OR REPLACE FUNCTION sync_app_user_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO app_users (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(split_part(NEW.email, '@', 1), ''), 'user_' || left(replace(NEW.id::text, '-', ''), 8)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync_app_user ON auth.users;

CREATE TRIGGER on_auth_user_created_sync_app_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION sync_app_user_on_auth_user_created();
