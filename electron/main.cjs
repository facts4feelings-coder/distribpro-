const { app, BrowserWindow, Menu, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// The built web app lives in <project>/dist (one level up from this file).
// Inside the installed app this is resources/app.asar/dist.
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, 'build', 'icon.ico');

// Optional: point the window at a running Vite dev server
//   set DISTRIBPRO_DEV_URL=http://localhost:5173
const DEV_URL = process.env.DISTRIBPRO_DEV_URL;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Serve the app from app://distribpro/ instead of file://.
// file:// blocks fetch(), which the local database (PGlite) needs to load its
// .wasm/.data files -- that was a cause of the blank/broken window.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    let filePath = path.normalize(path.join(DIST_DIR, rel));
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }
      const body = await fs.promises.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(body, { status: 200, headers: { 'Content-Type': type } });
    } catch (err) {
      return new Response('Not found: ' + rel, { status: 404 });
    }
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'DistribPro - Distribution Management System',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      dialog.showErrorBox(
        'DistribPro',
        'App build nahi mili (dist folder missing).\n\nPehle run.bat ya "npm run build:offline" chalayen.'
      );
      app.quit();
      return;
    }
    mainWindow.loadURL('app://distribpro/index.html');
  }

  // F12 opens developer tools (for troubleshooting), F5 reloads.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
    if (input.key === 'F5') mainWindow.webContents.reload();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(null);
}

// Only one copy of the app at a time -- two copies writing the same local
// database can corrupt it.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
