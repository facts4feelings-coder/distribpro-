/*
# Forgot-password recovery (security question + attempt limiting)

1. Plain-English explanation
- The app logs people in with USERNAME + password. Until now, a forgotten password
  could not be recovered from the app.
- We add a "recovery question and answer" per user. The owner/admin sets it for each
  user in Settings. On the login screen, a user who forgot their password enters
  their username, sees the question, and if they answer correctly they can set a
  new password.
- To stop guessing attacks, only 5 wrong answers per username are allowed in any
  15-minute window.

2. Modified Tables
- `app_users`
  - `recovery_question` (text, nullable — shown on the login screen when set)
  - `recovery_answer_hash` (text, nullable — SHA-256 hash of the answer, never the
    plain answer)

3. New Tables
- `password_reset_attempts`
  - `id` (bigserial, primary key)
  - `username` (text, not null)
  - `success` (boolean, not null, default false)
  - `created_at` (timestamp, default now)

4. Security
- RLS enabled on `password_reset_attempts` with NO policies: only the service role
  (edge functions) can read or write it. Browsers and anon keys can never touch it.
- `app_users` keeps its existing RLS: signed-in users can read rows (needed by the
  settings screen to show the question), but the new columns can only be WRITTEN by
  the service role via edge functions — no browser write path exists.
*/

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS recovery_question text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS recovery_answer_hash text;

CREATE TABLE IF NOT EXISTS password_reset_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_attempts_username_created_idx
ON password_reset_attempts (username, created_at);

ALTER TABLE password_reset_attempts ENABLE ROW LEVEL SECURITY;
