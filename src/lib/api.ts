// Renderer-side typed client for the Electron main-process API
// (window.api, exposed by electron/preload.ts). Pages migrate from
// `supabase.from(...)` / PGlite helpers to `api.<module>.<method>(...)`
// module by module: Settings (Phase 1), Auth/Users/Permissions/Licenses
// (Phase 2), master data (Phase 3), transactions (Phase 4), reports (5),
// backup (6).
// DTOs speak UI units (DECISIONS D8): taxRate is a plain percent number,
// money is rupees — integer paisa never crosses this boundary.
import type { Settings } from './types';

export interface SettingsDto {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currencySymbol: string;
  taxRate: number;
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

/** Adapter so the 26 existing useSettings() consumers keep receiving the
 *  legacy snake_case Settings shape untouched. */
export function settingsDtoToLegacy(d: SettingsDto): Settings {
  return {
    id: d.id,
    company_name: d.companyName,
    company_address: d.companyAddress,
    company_phone: d.companyPhone,
    company_email: d.companyEmail,
    currency_symbol: d.currencySymbol,
    tax_rate: d.taxRate,
    invoice_prefix: d.invoicePrefix,
    supplier_invoice_prefix: d.supplierInvoicePrefix,
    payment_voucher_prefix: d.paymentVoucherPrefix,
    expense_voucher_prefix: d.expenseVoucherPrefix,
    gate_pass_prefix: d.gatePassPrefix,
    sales_return_prefix: d.salesReturnPrefix,
    purchase_return_prefix: d.purchaseReturnPrefix,
    default_print_format: d.defaultPrintFormat,
    thermal_printer_width: d.thermalPrinterWidth,
    invoice_footer_note: d.invoiceFooterNote,
  };
}

export function settingsLegacyToDtoPatch(s: Partial<Settings>): Partial<Omit<SettingsDto, 'id' | 'createdAt'>> {
  const out: Partial<Omit<SettingsDto, 'id' | 'createdAt'>> = {};
  if (s.company_name !== undefined) out.companyName = s.company_name;
  if (s.company_address !== undefined) out.companyAddress = s.company_address;
  if (s.company_phone !== undefined) out.companyPhone = s.company_phone;
  if (s.company_email !== undefined) out.companyEmail = s.company_email;
  if (s.currency_symbol !== undefined) out.currencySymbol = s.currency_symbol;
  if (s.tax_rate !== undefined) out.taxRate = s.tax_rate;
  if (s.invoice_prefix !== undefined) out.invoicePrefix = s.invoice_prefix;
  if (s.supplier_invoice_prefix !== undefined) out.supplierInvoicePrefix = s.supplier_invoice_prefix;
  if (s.payment_voucher_prefix !== undefined) out.paymentVoucherPrefix = s.payment_voucher_prefix;
  if (s.expense_voucher_prefix !== undefined) out.expenseVoucherPrefix = s.expense_voucher_prefix;
  if (s.gate_pass_prefix !== undefined) out.gatePassPrefix = s.gate_pass_prefix;
  if (s.sales_return_prefix !== undefined) out.salesReturnPrefix = s.sales_return_prefix;
  if (s.purchase_return_prefix !== undefined) out.purchaseReturnPrefix = s.purchase_return_prefix;
  if (s.default_print_format !== undefined) out.defaultPrintFormat = s.default_print_format;
  if (s.thermal_printer_width !== undefined) out.thermalPrinterWidth = s.thermal_printer_width;
  if (s.invoice_footer_note !== undefined) out.invoiceFooterNote = s.invoice_footer_note ?? '';
  return out;
}

export interface SessionUser {
  id: string;
  username: string;
  permissions: string[];
}

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

export interface UpdateUserOpts {
  userId: string;
  username: string;
  permissions: string[] | null;
  recoveryQuestion?: string | null;
  recoveryAnswer?: string | null;
}

interface DistribProApi {
  settings: {
    get(): Promise<SettingsDto>;
    update(patch: Partial<Omit<SettingsDto, 'id' | 'createdAt'>>): Promise<SettingsDto>;
  };
  auth: {
    signIn(username: string, password: string): Promise<{ user?: SessionUser; error?: string }>;
    recoveryQuestion(username: string): Promise<{ question?: string; error?: string }>;
    resetPassword(username: string, answer: string, newPassword: string): Promise<{ error?: string }>;
  };
  users: {
    list(): Promise<{ users: { id: string; username: string }[] }>;
    create(username: string, password: string, permissions: string[] | null): Promise<{ error?: string }>;
    delete(userId: string): Promise<{ error?: string }>;
    update(opts: UpdateUserOpts): Promise<{ error?: string }>;
  };
  permissions: {
    get(userId: string): Promise<string[] | null>;
    listAll(): Promise<{ userId: string; permissions: string[] }[]>;
  };
  licenses: {
    list(): Promise<LicenseDto[]>;
    create(input: {
      licenseKey: string;
      customerName: string;
      maxDevices: number;
      expiresAt: string | null;
      isActive?: boolean;
      notes?: string | null;
    }): Promise<{ error?: string }>;
    setActive(id: string, isActive: boolean): Promise<{ error?: string }>;
    delete(id: string): Promise<{ error?: string }>;
  };
}

declare global {
  interface Window {
    api?: DistribProApi;
  }
}

function bridge(): DistribProApi {
  if (!window.api) {
    throw new Error('DistribPro desktop API not available — the SQLite build must run inside Electron.');
  }
  return window.api;
}

export const api: DistribProApi = {
  get settings() {
    return bridge().settings;
  },
  get auth() {
    return bridge().auth;
  },
  get users() {
    return bridge().users;
  },
  get permissions() {
    return bridge().permissions;
  },
  get licenses() {
    return bridge().licenses;
  },
};
