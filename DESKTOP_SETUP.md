# DistribPro — Windows Desktop App (Customer Offline Version)

## Building the Windows Installer

Easiest: double-click **`build.bat`** (checks Node.js, installs packages, builds).
To just run the app: double-click **`run.bat`**. See README.md.

Manual steps — requirements: Node.js 18 or newer (Node 20/22 LTS recommended) and npm.

1. Install dependencies:
   ```
   npm install
   ```

2. Build the Windows installer (.exe):
   ```
   npm run dist
   ```

   This produces (in the `release/` folder):
   - `DistribPro-Setup-1.0.0.exe` — NSIS installer (Install → Next → Next → Finish)
   - `DistribPro-Portable-1.0.0.exe` — portable standalone executable

3. Distribute the `DistribPro-Setup-1.0.0.exe` file to your customers. When they run it, the installer will:
   - Install DistribPro to `C:\Program Files\DistribPro` (path can be changed)
   - Create a desktop shortcut and Start Menu shortcut
   - Offer to launch DistribPro immediately

## Fully Offline — No Internet, No Server

The customer build is 100% offline. It needs no internet connection, ever:

- All data (customers, invoices, stock, vouchers, reports, users) is stored in a
  local database (PGlite, saved in the app's IndexedDB storage) on the
  customer's PC under `%APPDATA%\DistribPro`.
- No Supabase / cloud / network calls are compiled into the customer build.
  The regular web/dev build still uses Supabase — only the desktop customer
  build (`npm run dist`, `npm run build:offline`) is offline.
- Backup & Restore from Settings saves a full data copy as a file the customer
  can move between PCs.

## First Login (Every New Install)

- Username: `admin`
- Password: `admin123`

Change this password from Settings → Admin Users right after the first login.
Password recovery uses the security question configured per user in Settings.

## Licensing

The customer version activates with a license key (generated with `keygen.bat`
/ `npm run keygen`, or from an activated installation under Settings → License
Key Generator). The app stays locked
until a valid key is entered; expiry and device limits are enforced offline.

## Running in Development (Desktop)

```
npm run electron:dev
```

This builds the web app and launches it in an Electron window. To use the Vite
dev server with hot reload instead: run `npm run dev`, then in a second terminal
`set DISTRIBPRO_DEV_URL=http://localhost:5173` and `npm start`.

## Technical Notes

- Offline mode (`vite build --mode offline`, used by every desktop script) swaps the Supabase client for a local
  Postgres-compatible database (PGlite) running inside the app. PGlite's
  Postgres WASM files ship in `dist/assets/*.wasm`. Electron serves `dist/`
  over a private `app://` protocol (file:// blocks the fetch() PGlite needs);
  data persists across restarts in the Electron `userData` folder.
- Only one copy of the app can run at a time (protects the local database).
- The offline schema mirrors the cloud schema (same tables, triggers for stock
  auto-update and invoice status), so reports and balances behave identically.
- Building uses the terser minifier (the esbuild minifier crashes on the large
  Postgres WASM bundle).
