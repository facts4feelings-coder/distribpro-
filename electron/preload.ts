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
