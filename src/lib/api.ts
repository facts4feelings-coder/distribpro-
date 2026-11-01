// Renderer-side typed client for the Electron main-process API
// (window.api, exposed by electron/preload.ts). Pages will migrate from
// `supabase.from(...)` to `api.<module>.<method>(...)` module by module;
// Settings is the Phase 1 proof and the pattern for the rest.
// DTOs speak UI units (DECISIONS D8): taxRate is a plain percent number,
// money will be rupees — integer paisa never crosses this boundary.

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

interface DistribProApi {
  settings: {
    get(): Promise<SettingsDto>;
    update(patch: Partial<Omit<SettingsDto, 'id' | 'createdAt'>>): Promise<SettingsDto>;
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

export const api = {
  settings: {
    get: () => bridge().settings.get(),
    update: (patch: Partial<Omit<SettingsDto, 'id' | 'createdAt'>>) => bridge().settings.update(patch),
  },
};
