# DistribPro — Windows Desktop App (Offline, SQLite)

## Building the Windows Installer

Requirements: Node.js 18 or newer (Node 20 LTS recommended) and npm.

1. Install dependencies:
   ```
   npm install
   ```

2. Build the Windows executables:
   ```
   npm run dist
   ```

   This produces (in the `release/` folder):
   - `DistribPro-Setup-1.0.0.exe` — NSIS installer (Install → Next → Next → Finish)
   - `DistribPro-Portable-1.0.0.exe` — portable standalone executable

   Note: the 1.0.0 release shipped from a Linux build machine where
   electron-builder's own NSIS step could not run (its Wine-based installer
   stamping does not work in that sandbox). There, electron-builder produced
   the packaged app folder (`win-unpacked`), and the Setup exe was compiled
   from the same folder with a native NSIS compiler using `installer.nsi`
   in this repo; the portable deliverable is a zip of that folder. On a
   Windows PC, plain `npm run dist` works end to end as above.

3. Distribute the `DistribPro-Setup-1.0.0.exe` file to your customers. When they run it, the installer will:
   - Install DistribPro to `C:\Program Files\DistribPro` (path can be changed)
   - Create a desktop shortcut and Start Menu shortcut
   - Offer to launch DistribPro immediately

The executables are unsigned, so Windows SmartScreen may show a warning on
first run — click "More info" → "Run anyway".

## Fully Offline — No Internet, No Server

DistribPro is 100% offline. It needs no internet connection, ever:

- All data (customers, invoices, stock, vouchers, reports, users) is stored in
  a local SQLite database on the customer's PC at:
  `%APPDATA%\DistribPro\distribpro-data\distribpro.db`
- There is no cloud, no Supabase, no network code in the app at all.
- Backup & Restore from Settings saves a full data copy as a `.json` file the
  customer can move between PCs.

## Moving Data from the Old Version

The old (PGlite) version stored data in a format the new database cannot read
directly, so move the data with a backup file:

1. In the OLD app: Settings → Backup → **Download Full Backup** (saves a
   `distribpro-backup-<date>.json` file).
2. Install and open the NEW app, activate it with the license key, and log in.
3. In the NEW app: Settings → Backup → **Restore from Backup** and choose the
   file. Records are merged in; user accounts are NOT part of the backup, so
   recreate users under Settings → Admin Users if needed.

## First Login (Every New Install)

- Username: `admin`
- Password: `admin123`

Change this password from Settings → Admin Users right after the first login.
Password recovery uses the security question configured per user in Settings.

## Licensing

The customer version activates with a license key (generated from your admin
installation under Settings → License Key Generator). The app stays locked
until a valid key is entered; expiry and device limits are enforced offline.

## Running in Development (Desktop)

```
npm run electron:dev
```

This builds the web app and the Electron main process, then launches the app
in an Electron window.

## Technical Notes

- The database layer is SQLite via better-sqlite3 + Drizzle ORM, running in
  the Electron main process. The renderer reaches it only through the typed
  `window.api` bridge (electron/preload.ts) — no SQL in the UI.
- better-sqlite3 ships Node-API prebuilds inside the npm package
  (`prebuilds/win32-x64.node`), so no native rebuild is needed when packaging.
- Stock adjustments, invoice status and party balances are computed in the
  service layer (`electron/services/`), in the same transaction as the
  invoice change itself. This fixed the old trigger bugs: sale edits no
  longer double-deduct stock, deletes restore stock, and sales/purchase
  returns now actually move stock (the old trigger checked for
  `sales_return` while the app wrote `sales-return`, so returns never
  restocked).
- Building uses the terser minifier for the renderer bundle.
