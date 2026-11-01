// License record-keeping (Phase 2) — port of the admin side of
// LicenseKeyGenerator.tsx, which used the `licenses` table directly.
// NOTE (DECISIONS D11): key generation/verification itself stays in the
// renderer (src/lib/license.ts, offline checksum) and never reads this
// table — this service only stores the issued-key registry for the admin.
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { licenses } from '../db/schema';

export interface LicenseDto {
  id: string;
  licenseKey: string;
  customerName: string;
  maxDevices: number;
  expiresAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLicenses(db: Db, limit = 100): Promise<LicenseDto[]> {
  const rows = await db.select().from(licenses).orderBy(desc(licenses.createdAt)).limit(limit);
  return rows;
}

export async function createLicense(
  db: Db,
  input: {
    licenseKey: string;
    customerName: string;
    maxDevices: number;
    expiresAt: string | null;
    isActive?: boolean;
    notes?: string | null;
  },
): Promise<{ error?: string }> {
  try {
    await db.insert(licenses).values({
      licenseKey: input.licenseKey,
      customerName: input.customerName,
      maxDevices: input.maxDevices,
      expiresAt: input.expiresAt,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save license key' };
  }
}

export async function setLicenseActive(
  db: Db,
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  await db
    .update(licenses)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(licenses.id, id));
  return {};
}

export async function deleteLicense(db: Db, id: string): Promise<{ error?: string }> {
  await db.delete(licenses).where(eq(licenses.id, id));
  return {};
}
