// Preload bridge — the ONLY way the renderer reaches the main process.
// New typed API lives on window.api; the legacy electronAPI.dataDir channel
// is kept while PGlite-era pages are still being migrated.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: unknown) => ipcRenderer.invoke('settings:update', patch),
  },
  auth: {
    signIn: (username: string, password: string) => ipcRenderer.invoke('auth:signIn', username, password),
    recoveryQuestion: (username: string) => ipcRenderer.invoke('auth:recoveryQuestion', username),
    resetPassword: (username: string, answer: string, newPassword: string) =>
      ipcRenderer.invoke('auth:resetPassword', username, answer, newPassword),
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (username: string, password: string, permissions: string[] | null) =>
      ipcRenderer.invoke('users:create', username, password, permissions),
    delete: (userId: string) => ipcRenderer.invoke('users:delete', userId),
    update: (opts: unknown) => ipcRenderer.invoke('users:update', opts),
  },
  permissions: {
    get: (userId: string) => ipcRenderer.invoke('permissions:get', userId),
    listAll: () => ipcRenderer.invoke('permissions:listAll'),
  },
  customers: {
    list: () => ipcRenderer.invoke('customers:list'),
    get: (id: string) => ipcRenderer.invoke('customers:get', id),
    create: (input: unknown) => ipcRenderer.invoke('customers:create', input),
    bulkCreate: (inputs: unknown) => ipcRenderer.invoke('customers:bulkCreate', inputs),
    update: (id: string, input: unknown) => ipcRenderer.invoke('customers:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('customers:delete', id),
  },
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    create: (input: unknown) => ipcRenderer.invoke('suppliers:create', input),
    bulkCreate: (inputs: unknown) => ipcRenderer.invoke('suppliers:bulkCreate', inputs),
    update: (id: string, input: unknown) => ipcRenderer.invoke('suppliers:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('suppliers:delete', id),
  },
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    get: (id: string) => ipcRenderer.invoke('products:get', id),
    create: (input: unknown) => ipcRenderer.invoke('products:create', input),
    bulkCreate: (inputs: unknown) => ipcRenderer.invoke('products:bulkCreate', inputs),
    update: (id: string, input: unknown) => ipcRenderer.invoke('products:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('products:delete', id),
  },
  routes: {
    list: () => ipcRenderer.invoke('routes:list'),
    create: (input: unknown) => ipcRenderer.invoke('routes:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('routes:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('routes:delete', id),
  },
  customerRoutes: {
    list: () => ipcRenderer.invoke('customerRoutes:list'),
    assign: (routeId: string, customerId: string) => ipcRenderer.invoke('customerRoutes:assign', routeId, customerId),
    unassign: (id: string) => ipcRenderer.invoke('customerRoutes:unassign', id),
  },
  employees: {
    list: () => ipcRenderer.invoke('employees:list'),
    create: (input: unknown) => ipcRenderer.invoke('employees:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('employees:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('employees:delete', id),
  },
  salaryPayments: {
    list: () => ipcRenderer.invoke('salaryPayments:list'),
    create: (input: unknown) => ipcRenderer.invoke('salaryPayments:create', input),
    delete: (id: string) => ipcRenderer.invoke('salaryPayments:delete', id),
  },
  income: {
    list: () => ipcRenderer.invoke('income:list'),
    create: (input: unknown) => ipcRenderer.invoke('income:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('income:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('income:delete', id),
  },
  invoices: {
    list: (kind: string, type: string) => ipcRenderer.invoke('invoices:list', kind, type),
    listForParty: (kind: string, partyId: string) => ipcRenderer.invoke('invoices:listForParty', kind, partyId),
    get: (kind: string, id: string) => ipcRenderer.invoke('invoices:get', kind, id),
    items: (kind: string, invoiceId: string) => ipcRenderer.invoke('invoices:items', kind, invoiceId),
    count: (kind: string, type: string) => ipcRenderer.invoke('invoices:count', kind, type),
    create: (kind: string, input: unknown, items: unknown, opts?: unknown) => ipcRenderer.invoke('invoices:create', kind, input, items, opts),
    update: (kind: string, id: string, input: unknown, items: unknown) => ipcRenderer.invoke('invoices:update', kind, id, input, items),
    delete: (kind: string, id: string) => ipcRenderer.invoke('invoices:delete', kind, id),
    customerRates: (customerId: string) => ipcRenderer.invoke('invoices:customerRates', customerId),
    listByDate: (kind: string, date: string) => ipcRenderer.invoke('invoices:listByDate', kind, date),
  },
  paymentVouchers: {
    list: () => ipcRenderer.invoke('paymentVouchers:list'),
    listForParty: (kind: string, partyId: string) => ipcRenderer.invoke('paymentVouchers:listForParty', kind, partyId),
    create: (input: unknown) => ipcRenderer.invoke('paymentVouchers:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('paymentVouchers:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('paymentVouchers:delete', id),
  },
  expenseVouchers: {
    list: () => ipcRenderer.invoke('expenseVouchers:list'),
    create: (input: unknown) => ipcRenderer.invoke('expenseVouchers:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('expenseVouchers:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('expenseVouchers:delete', id),
  },
  gatePasses: {
    list: () => ipcRenderer.invoke('gatePasses:list'),
    find: (passDate: string, notes: string) => ipcRenderer.invoke('gatePasses:find', passDate, notes),
    count: () => ipcRenderer.invoke('gatePasses:count'),
    create: (input: unknown) => ipcRenderer.invoke('gatePasses:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('gatePasses:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('gatePasses:delete', id),
  },
  reports: {
    dashboard: (today: string) => ipcRenderer.invoke('reports:dashboard', today),
    printDataset: () => ipcRenderer.invoke('reports:printDataset'),
    dataset: () => ipcRenderer.invoke('reports:dataset'),
  },
  targets: {
    list: (month: string) => ipcRenderer.invoke('targets:list', month),
    create: (input: unknown) => ipcRenderer.invoke('targets:create', input),
    update: (id: string, input: unknown) => ipcRenderer.invoke('targets:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('targets:delete', id),
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: (backup: unknown) => ipcRenderer.invoke('backup:import', backup),
    log: (kind: string, fileName: string | null, sizeBytes: number, tables: unknown) => ipcRenderer.invoke('backup:log', kind, fileName, sizeBytes, tables),
    history: () => ipcRenderer.invoke('backup:history'),
    deleteHistory: (id: string) => ipcRenderer.invoke('backup:deleteHistory', id),
  },
  licenses: {
    list: () => ipcRenderer.invoke('licenses:list'),
    create: (input: unknown) => ipcRenderer.invoke('licenses:create', input),
    setActive: (id: string, isActive: boolean) => ipcRenderer.invoke('licenses:setActive', id, isActive),
    delete: (id: string) => ipcRenderer.invoke('licenses:delete', id),
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  dataDir: () => ipcRenderer.invoke('distribpro:dataDir'),
});
