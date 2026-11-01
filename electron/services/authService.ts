// Auth + admin-user + permissions service (Phase 2).
// Semantics are a faithful port of src/lib/offlineDb.ts (auth) and
// src/lib/localAdmin.ts (user management) — including their exact validation
// messages and the permissions conventions:
//   - no user_permissions row        -> permissions null -> FULL access
//   - a row with an empty array      -> no access at all
//   - createUser: a provided array (even empty) is stored as a row
//   - updateUser: null OR empty array removes the row (back to full access)
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appUsers, userPermissions } from '../db/schema';
import { hashPassword, hashRecoveryAnswer, randomSalt } from '../lib/crypto';

export interface SessionUser {
  id: string;
  username: string;
  permissions: string[];
}

const byUsername = (username: string) =>
  sql`lower(${appUsers.username}) = ${username.trim().toLowerCase()}`;

async function findUser(db: Db, username: string) {
  const rows = await db.select().from(appUsers).where(byUsername(username)).limit(1);
  return rows[0] ?? null;
}

export async function signIn(
  db: Db,
  username: string,
  password: string,
): Promise<{ user?: SessionUser; error?: string }> {
  const user = await findUser(db, username);
  if (!user) return { error: 'Invalid username or password' };
  if (hashPassword(user.salt, password) !== user.passwordHash) {
    return { error: 'Invalid username or password' };
  }
  await db
    .update(appUsers)
    .set({ lastLogin: new Date().toISOString() })
    .where(eq(appUsers.id, user.id));
  const permRows = await db
    .select({ permissions: userPermissions.permissions })
    .from(userPermissions)
    .where(eq(userPermissions.userId, user.id))
    .limit(1);
  return {
    user: { id: user.id, username: user.username, permissions: permRows[0]?.permissions ?? [] },
  };
}

export async function getRecoveryQuestion(
  db: Db,
  username: string,
): Promise<{ question?: string; error?: string }> {
  const user = await findUser(db, username);
  if (!user || !user.recoveryQuestion) {
    return { error: 'Could not find a recovery question for this username' };
  }
  return { question: user.recoveryQuestion };
}

export async function resetPassword(
  db: Db,
  username: string,
  answer: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const user = await findUser(db, username);
  if (!user || !user.recoveryAnswerHash) {
    return { error: 'Could not reset the password for this username' };
  }
  if (hashRecoveryAnswer(user.salt, answer) !== user.recoveryAnswerHash) {
    return { error: 'Incorrect answer' };
  }
  const salt = randomSalt();
  await db
    .update(appUsers)
    .set({ salt, passwordHash: hashPassword(salt, newPassword) })
    .where(eq(appUsers.id, user.id));
  return {};
}

export async function listUsers(db: Db): Promise<{ users: { id: string; username: string }[] }> {
  const rows = await db
    .select({ id: appUsers.id, username: appUsers.username })
    .from(appUsers)
    .orderBy(asc(appUsers.username));
  return { users: rows };
}

async function setPermissionsRow(db: Db, userId: string, permissions: string[]): Promise<void> {
  await db
    .insert(userPermissions)
    .values({ userId, permissions, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: userPermissions.userId,
      set: { permissions, updatedAt: new Date().toISOString() },
    });
}

export async function createUser(
  db: Db,
  username: string,
  password: string,
  permissions: string[] | null,
): Promise<{ error?: string }> {
  const clean = username.trim();
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(clean)) {
    return { error: 'Username must be 3-30 letters, numbers, dots, dashes or underscores' };
  }
  if (password.length < 6) return { error: 'Password must be at least 6 characters' };
  if (await findUser(db, clean)) return { error: 'This username is already taken' };
  const salt = randomSalt();
  const inserted = await db
    .insert(appUsers)
    .values({ username: clean, salt, passwordHash: hashPassword(salt, password) })
    .returning({ id: appUsers.id });
  if (permissions && Array.isArray(permissions)) {
    await setPermissionsRow(db, inserted[0].id, permissions);
  }
  return {};
}

export async function deleteUser(db: Db, userId: string): Promise<{ error?: string }> {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  await db.delete(appUsers).where(eq(appUsers.id, userId));
  return {};
}

export async function updateUser(
  db: Db,
  opts: {
    userId: string;
    username: string;
    permissions: string[] | null;
    recoveryQuestion?: string | null;
    recoveryAnswer?: string | null;
  },
): Promise<{ error?: string }> {
  const { userId, username, permissions, recoveryQuestion, recoveryAnswer } = opts;
  await db.update(appUsers).set({ username: username.trim() }).where(eq(appUsers.id, userId));
  if (permissions && Array.isArray(permissions) && permissions.length > 0) {
    await setPermissionsRow(db, userId, permissions);
  } else {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  }
  if (recoveryQuestion && recoveryAnswer) {
    const rows = await db
      .select({ salt: appUsers.salt })
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .limit(1);
    const salt = rows[0]?.salt ?? randomSalt();
    await db
      .update(appUsers)
      .set({
        recoveryQuestion,
        recoveryAnswerHash: hashRecoveryAnswer(salt, recoveryAnswer),
      })
      .where(eq(appUsers.id, userId));
  }
  return {};
}

/** null = no permissions row = full access (usePermissions semantics). */
export async function getPermissions(db: Db, userId: string): Promise<string[] | null> {
  const rows = await db
    .select({ permissions: userPermissions.permissions })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .limit(1);
  return rows.length === 0 ? null : rows[0].permissions;
}

export async function listAllPermissions(
  db: Db,
): Promise<{ userId: string; permissions: string[] }[]> {
  const rows = await db
    .select({ userId: userPermissions.userId, permissions: userPermissions.permissions })
    .from(userPermissions);
  return rows;
}
