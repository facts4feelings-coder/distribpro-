// IPC registration for the main process. Kept behind a minimal interface so
// the wiring can be unit-tested without launching Electron.
import type { Db } from '../db/client';
import { getSettings, updateSettings, type SettingsDto } from '../services/settingsService';

export interface IpcMainLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void;
}

export function registerHandlers(ipc: IpcMainLike, getDb: () => Db): void {
  ipc.handle('settings:get', async () => getSettings(getDb()));
  ipc.handle('settings:update', async (_e, patch: Partial<SettingsDto>) => updateSettings(getDb(), patch));
  // Phase 2+: auth:*, customers:*, invoices:*, reports:*, backup:* …
}
