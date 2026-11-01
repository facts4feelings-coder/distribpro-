// First-run seed — mirrors the old OFFLINE_SEED_SQL so behaviour on a fresh
// install does not change: default settings row + admin / admin123
// (same salt + SHA-256 hash as the PGlite seed, so the old credentials work).
import { count } from 'drizzle-orm';
import type { Db } from './client';
import { settings, appUsers } from './schema';

export const DEFAULT_ADMIN = {
  username: 'admin',
  // sha256('distribpro-default:admin123') — identical to the legacy seed.
  passwordHash: '4ce1cbe16d4601c196baa607eabc8712674757873c0364bfbefbdc4cfc36e4b7',
  salt: 'distribpro-default',
};

export async function seedIfEmpty(db: Db): Promise<{ seededSettings: boolean; seededAdmin: boolean }> {
  let seededSettings = false;
  let seededAdmin = false;

  const [{ value: settingsCount }] = await db.select({ value: count() }).from(settings);
  if (settingsCount === 0) {
    await db.insert(settings).values({
      companyName: 'My Distribution Company',
      companyAddress: '',
      companyPhone: '',
      currencySymbol: 'Rs',
    });
    seededSettings = true;
  }

  const [{ value: usersCount }] = await db.select({ value: count() }).from(appUsers);
  if (usersCount === 0) {
    await db.insert(appUsers).values(DEFAULT_ADMIN);
    seededAdmin = true;
  }

  return { seededSettings, seededAdmin };
}
