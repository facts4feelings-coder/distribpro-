// Password hashing — byte-for-byte compatible with the legacy renderer code
// (offlineDb.ts / localAdmin.ts): hash = sha256(`${salt}:${password}`),
// salt = 16 random bytes as hex, recovery answers hashed the same way after
// trim + lowercase. Keeping the scheme identical means existing users'
// passwords (and the seeded admin/admin123) keep working after migration.
import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function randomSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(salt: string, password: string): string {
  return sha256Hex(`${salt}:${password}`);
}

export function hashRecoveryAnswer(salt: string, answer: string): string {
  return sha256Hex(`${salt}:${answer.trim().toLowerCase()}`);
}
