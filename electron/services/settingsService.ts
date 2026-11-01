// Settings service — the Phase 1 end-to-end proof module.
// Speaks UI units across the boundary (DECISIONS D8): taxRate crosses as a
// plain percent number (e.g. 5.5), stored as integer x100 (550).
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { settings } from '../db/schema';
import { toPercentX100, fromPercentX100 } from '../lib/units';

export interface SettingsDto {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currencySymbol: string;
  taxRate: number; // percent, UI units
  invoicePrefix: string;
  supplierInvoicePrefix: string;
  paymentVoucherPrefix: string;
  expenseVoucherPrefix: string;
  gatePassPrefix: string;
  salesReturnPrefix: string;
  purchaseReturnPrefix: string;
  defaultPrintFormat: string;
  thermalPrinterWidth: string;
  invoiceFooterNote: string;
  createdAt: string | null;
}

type SettingsRow = typeof settings.$inferSelect;

function toDto(row: SettingsRow): SettingsDto {
  const { taxRate, ...rest } = row;
  return { ...rest, taxRate: fromPercentX100(taxRate) };
}

export async function getSettings(db: Db): Promise<SettingsDto> {
  const rows = await db.select().from(settings).limit(1);
  if (rows.length === 0) throw new Error('Settings row missing — seed did not run');
  return toDto(rows[0]);
}

export async function updateSettings(db: Db, patch: Partial<Omit<SettingsDto, 'id' | 'createdAt'>>): Promise<SettingsDto> {
  const current = await getSettings(db);
  const { taxRate, ...rest } = patch;
  await db
    .update(settings)
    .set({ ...rest, ...(taxRate !== undefined ? { taxRate: toPercentX100(taxRate) } : {}) })
    .where(eq(settings.id, current.id));
  return getSettings(db);
}
