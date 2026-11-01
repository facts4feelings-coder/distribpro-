import { PGlite } from '@electric-sql/pglite';
import { OFFLINE_SCHEMA_SQL, OFFLINE_SEED_SQL } from './offlineSchema';

// Local Postgres that stores its data in the user's app-data folder, so the
// desktop app works with zero internet. Schemas, triggers and the seeded admin
// user mirror the online Supabase project exactly.
let db: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (db) return db;
  const dataDir = await resolveDataDir();
  db = new PGlite(dataDir);
  await db.exec('CREATE TABLE IF NOT EXISTS _meta (key text PRIMARY KEY, value text)');
  const applied = await db.query<{ key: string }>("SELECT key FROM _meta WHERE key = 'schema_v1'");
  if (applied.rows.length === 0) {
    await db.exec(OFFLINE_SCHEMA_SQL);
    await db.exec(OFFLINE_SEED_SQL);
    await db.exec("INSERT INTO _meta (key, value) VALUES ('schema_v1', now()::text) ON CONFLICT (key) DO NOTHING");
  }
  return db;
}

async function resolveDataDir(): Promise<string> {
  const electron = (window as unknown as { electronAPI?: { dataDir?: () => Promise<string> } }).electronAPI;
  if (electron?.dataDir) {
    try {
      return await electron.dataDir();
    } catch {
      // fall through to IndexedDB
    }
  }
  return 'idb://distribpro-offline';
}

export async function localQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const database = await getDb();
  const res = await database.query<T>(sql, params);
  return { rows: res.rows as T[] };
}

// ---- Local auth (replaces Supabase Auth + login edge functions) ----
// Passwords are salted+hashed with SHA-256 in the browser; recovery question
// answers are hashed the same way. A tiny local hash is sufficient here because
// the threat model is a shop clerk, not a machine owner with disk access.

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface LocalUser {
  id: string;
  username: string;
  permissions: string[];
}

export async function localSignIn(username: string, password: string): Promise<{ user?: LocalUser; error?: string }> {
  const database = await getDb();
  const res = await database.query<{ id: string; username: string; password_hash: string; salt: string; permissions: string[] | null }>(
    `SELECT u.id, u.username, u.password_hash, u.salt, p.permissions
     FROM app_users u LEFT JOIN user_permissions p ON p.user_id = u.id
     WHERE lower(u.username) = lower($1)`,
    [username.trim()]
  );
  const row = res.rows[0];
  if (!row) return { error: 'Invalid username or password' };
  const hash = await sha256(`${row.salt}:${password}`);
  if (hash !== row.password_hash) return { error: 'Invalid username or password' };
  await database.query("UPDATE app_users SET last_login = now() WHERE id = $1", [row.id]);
  return { user: { id: row.id, username: row.username, permissions: row.permissions ?? [] } };
}

export async function localGetRecoveryQuestion(username: string): Promise<{ question?: string; error?: string }> {
  const database = await getDb();
  const res = await database.query<{ recovery_question: string | null }>(
    'SELECT recovery_question FROM app_users WHERE lower(username) = lower($1)',
    [username.trim()]
  );
  const row = res.rows[0];
  if (!row || !row.recovery_question) return { error: 'Could not find a recovery question for this username' };
  return { question: row.recovery_question };
}

export async function localResetPassword(username: string, answer: string, newPassword: string): Promise<{ error?: string }> {
  const database = await getDb();
  const res = await database.query<{ recovery_answer_hash: string | null; salt: string }>(
    'SELECT recovery_answer_hash, salt FROM app_users WHERE lower(username) = lower($1)',
    [username.trim()]
  );
  const row = res.rows[0];
  if (!row || !row.recovery_answer_hash) return { error: 'Could not reset the password for this username' };
  const answerHash = await sha256(`${row.salt}:${answer.trim().toLowerCase()}`);
  if (answerHash !== row.recovery_answer_hash) return { error: 'Incorrect answer' };
  const newSalt = randomHex(16);
  const newHash = await sha256(`${newSalt}:${newPassword}`);
  await database.query('UPDATE app_users SET password_hash = $1, salt = $2 WHERE lower(username) = lower($3)', [newHash, newSalt, username.trim()]);
  return {};
}

export async function localSignOut(): Promise<void> {
  // Local session lives in localStorage; nothing to revoke server-side.
}

export async function getLocalSession(): Promise<LocalUser | null> {
  const raw = localStorage.getItem('distribpro_local_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

export function setLocalSession(user: LocalUser | null): void {
  if (user) localStorage.setItem('distribpro_local_session', JSON.stringify(user));
  else localStorage.removeItem('distribpro_local_session');
}
