// DistribPro — Electron main process (SQLite version, Phase 1 skeleton).
// DB file: <userData>/distribpro.db (better-sqlite3, WAL). The legacy
// electron/main.cjs + PGlite flow stays in place until the renderer switch
// in later phases; this file is bundled to electron-dist/ by
// `npm run build:electron` and becomes the real entry at cutover (Phase 8).
import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDatabase, type Db } from './db/client';
import { seedIfEmpty } from './db/seed';
import { registerHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let db: Db | null = null;

function dataDir(): string {
  const dir = path.join(app.getPath('userData'), 'distribpro-data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function migrationsFolder(): string {
  // Bundled layout: electron-dist/main.cjs sits next to a copied
  // db/migrations folder in the packaged app (Phase 8 packaging detail).
  return app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '..', 'electron', 'db', 'migrations');
}

async function initDb(): Promise<Db> {
  if (db) return db;
  // Keep the DB file inside distribpro-data so backups stay in one folder.
  const file = path.join(dataDir(), 'distribpro.db');
  db = openDatabase(file, migrationsFolder());
  await seedIfEmpty(db);
  return db;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'DistribPro - Distribution Management System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  Menu.setApplicationMenu(null);
}

// Legacy channel kept so the PGlite-era renderer keeps working during the
// phased migration (it asks where its data folder is).
ipcMain.handle('distribpro:dataDir', () => dataDir());

app.whenReady().then(async () => {
  await initDb();
  registerHandlers(ipcMain, () => {
    if (!db) throw new Error('DB not initialised');
    return db;
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
