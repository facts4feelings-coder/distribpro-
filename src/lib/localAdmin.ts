// Local admin-user management: replaces the create-admin-user edge function
// when the app runs fully offline. Users live in the local app_users table;
// passwords and recovery answers use the same salted-hash scheme as login.

import { localQuery } from './offlineDb';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listAdminUsers(): Promise<{ users: { id: string; username: string }[] }> {
  const { rows } = await localQuery<{ id: string; username: string }>(
    'SELECT id, username FROM app_users ORDER BY username'
  );
  return { users: rows };
}

export async function createAdminUser(
  username: string,
  password: string,
  permissions: string[] | null
): Promise<{ error?: string }> {
  const clean = username.trim();
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(clean)) return { error: 'Username must be 3-30 letters, numbers, dots, dashes or underscores' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters' };
  const existing = await localQuery('SELECT id FROM app_users WHERE lower(username) = lower($1)', [clean]);
  if (existing.rows.length) return { error: 'This username is already taken' };
  const salt = randomHex(16);
  const hash = await sha256(`${salt}:${password}`);
  const { rows } = await localQuery<{ id: string }>(
    'INSERT INTO app_users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id',
    [clean, hash, salt]
  );
  if (permissions && Array.isArray(permissions)) {
    await localQuery(
      'INSERT INTO user_permissions (user_id, permissions) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET permissions = $2, updated_at = now()',
      [rows[0].id, permissions]
    );
  }
  return {};
}

export async function deleteAdminUser(userId: string): Promise<{ error?: string }> {
  await localQuery('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
  await localQuery('DELETE FROM app_users WHERE id = $1', [userId]);
  return {};
}

export async function updateAdminUser(opts: {
  userId: string;
  username: string;
  permissions: string[] | null;
  recoveryQuestion?: string | null;
  recoveryAnswer?: string | null;
}): Promise<{ error?: string }> {
  const { userId, username, permissions, recoveryQuestion, recoveryAnswer } = opts;
  await localQuery('UPDATE app_users SET username = $1 WHERE id = $2', [username.trim(), userId]);
  if (permissions && Array.isArray(permissions) && permissions.length > 0) {
    await localQuery(
      'INSERT INTO user_permissions (user_id, permissions) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET permissions = $2, updated_at = now()',
      [userId, permissions]
    );
  } else {
    await localQuery('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
  }
  if (recoveryQuestion && recoveryAnswer) {
    const res = await localQuery<{ salt: string }>('SELECT salt FROM app_users WHERE id = $1', [userId]);
    const salt = res.rows[0]?.salt ?? randomHex(16);
    const answerHash = await sha256(`${salt}:${recoveryAnswer.trim().toLowerCase()}`);
    await localQuery('UPDATE app_users SET recovery_question = $1, recovery_answer_hash = $2 WHERE id = $3', [
      recoveryQuestion, answerHash, userId,
    ]);
  }
  return {};
}
