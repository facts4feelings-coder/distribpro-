// IPC registration for the main process. Kept behind a minimal interface so
// the wiring can be unit-tested without launching Electron.
import type { Db } from '../db/client';
import { getSettings, updateSettings, type SettingsDto } from '../services/settingsService';
import {
  signIn, getRecoveryQuestion, resetPassword,
  listUsers, createUser, deleteUser, updateUser,
  getPermissions, listAllPermissions,
} from '../services/authService';
import {
  listLicenses, createLicense, setLicenseActive, deleteLicense,
  type LicenseDto,
} from '../services/licenseService';

export interface IpcMainLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void;
}

export function registerHandlers(ipc: IpcMainLike, getDb: () => Db): void {
  // Settings (Phase 1)
  ipc.handle('settings:get', async () => getSettings(getDb()));
  ipc.handle('settings:update', async (_e, patch: Partial<SettingsDto>) => updateSettings(getDb(), patch));

  // Auth + users + permissions (Phase 2)
  ipc.handle('auth:signIn', async (_e, username: string, password: string) => signIn(getDb(), username, password));
  ipc.handle('auth:recoveryQuestion', async (_e, username: string) => getRecoveryQuestion(getDb(), username));
  ipc.handle('auth:resetPassword', async (_e, username: string, answer: string, newPassword: string) =>
    resetPassword(getDb(), username, answer, newPassword));
  ipc.handle('users:list', async () => listUsers(getDb()));
  ipc.handle('users:create', async (_e, username: string, password: string, permissions: string[] | null) =>
    createUser(getDb(), username, password, permissions));
  ipc.handle('users:delete', async (_e, userId: string) => deleteUser(getDb(), userId));
  ipc.handle('users:update', async (_e, opts: Parameters<typeof updateUser>[1]) => updateUser(getDb(), opts));
  ipc.handle('permissions:get', async (_e, userId: string) => getPermissions(getDb(), userId));
  ipc.handle('permissions:listAll', async () => listAllPermissions(getDb()));

  // Licenses registry (Phase 2)
  ipc.handle('licenses:list', async () => listLicenses(getDb()));
  ipc.handle('licenses:create', async (_e, input: Parameters<typeof createLicense>[1]) => createLicense(getDb(), input));
  ipc.handle('licenses:setActive', async (_e, id: string, isActive: boolean) => setLicenseActive(getDb(), id, isActive));
  ipc.handle('licenses:delete', async (_e, id: string) => deleteLicense(getDb(), id));
  // Phase 3+: customers:*, products:*, invoices:*, reports:*, backup:* …
}

export type { LicenseDto };
