// Preload bridge — the ONLY way the renderer reaches the main process.
// New typed API lives on window.api; the legacy electronAPI.dataDir channel
// is kept while PGlite-era pages are still being migrated.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: unknown) => ipcRenderer.invoke('settings:update', patch),
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  dataDir: () => ipcRenderer.invoke('distribpro:dataDir'),
});
