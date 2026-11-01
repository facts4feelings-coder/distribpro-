# DistribPro — SQLite Migration Plan

**Faisla (2026-11-02):** App sirf **offline** rahe gi. Online/Supabase mode khatam.
**Target stack:** Electron + React + TypeScript + Tailwind CSS + SQLite (better-sqlite3 + Drizzle ORM)
**Maujooda stack:** Electron + React + TS + Tailwind + PGlite (Postgres WASM) + hath se likha `localSupabase.ts` shim + Supabase (online build)

> Ye plan code ka pura inventory le kar banaya gaya hai (neeche asal numbers diye hain), andaza par nahi.

---

## 1. Codebase inventory — migration kitni bari hai

| Cheez | Asal number |
|---|---|
| Tables | **22** (customers, suppliers, products, customer_invoices + items, supplier_invoices + items, payment/expense vouchers, gate_passes, salaries, routes, settings, app_users, user_permissions, licenses, activations, backup_history, waghera) |
| Files jo `supabase` use karti hain | **36 files** |
| Kul data calls (`.from(...)`) | **222** — select 133, insert 38, update 23, delete 30, upsert 1 |
| Sab se zyada calls wali files | CustomerInvoices (20), SupplierInvoices (16), SalesReturns (14), PurchaseReturns (14), PaymentVouchers (14), QuickSale (10), GatePasses (10) |
| Filters | zyada tar simple: `eq` 111, `order` 59, `gt/gte` 24, `lt/lte` 16, `limit` 11, `single/maybeSingle` 14, `ilike` 2, `in` 3, count-exact 8 |
| Joins | Embedded selects (`customers(*)`, `suppliers(name)` waghera) — Drizzle me `leftJoin` / relational queries banengi |
| Database triggers/functions | **2 functions, 4 triggers** (Postgres PL/pgSQL): (1) invoice item par stock auto-adjust, (2) balance se invoice status auto (paid/partial/unpaid) |
| App-code me pehle se mojood logic | Customer/supplier balance recalc (`customerBalance.ts`), invoice number banana (prefix + count, maslan `INV-0001`) |
| Jo NAHI hai (khushkhabri) | Koi `rpc` nahi, koi Supabase Storage nahi, koi Supabase Auth nahi — auth pehle se local hai |

**Matlab:** migration darmiyani-bari hai. Mushkil hissa queries ki tadad nahi, balkay wo 4 triggers hain jin ka kaam ab code me karna hoga — wahan ek ghalti = stock/balance kharab.

## 2. Type conversion — Postgres se SQLite

| Postgres (abhi) | SQLite (Drizzle) | Note |
|---|---|---|
| `uuid` ×36, `gen_random_uuid()` | `text` primary key | ID app/main code me `crypto.randomUUID()` se bane gi. Purane IDs text ke tor par waise hi import ho jayen ge |
| `numeric(12,2)` ×33 (paisay) | **`integer` — paisa/cents me** (tajweez) | Rs 150.50 = `15050`. Float (`real`) accounting me rounding ghalti deta hai, is liye money ke liye integer. UI par dikhate waqt /100. **Ye is plan ka sab se ahem technical faisla hai — Phase 0 me confirm hoga** |
| Quantity wali `numeric` | `real` ya integer (×1000) | Product quantity ke decimals dekh kar Phase 0 me tay hoga |
| `timestamptz` ×25 | `text` (ISO string) | UI pehle hi dates ko string samajhta hai, sab se kam tabdeeli |
| `date` ×10 | `text` | — |
| `boolean` ×2 | `integer` (Drizzle `mode: 'boolean'`) | — |
| `jsonb` ×1 (backup_history) | `text` (`mode: 'json'`) | — |
| PL/pgSQL triggers ×4 | **App-layer service functions** (transactions me) | Neeche section 4 dekhen |

## 3. Target architecture

```
┌─ Renderer (React) ─────────────────────────────┐
│  Pages (UI taqreeban waisa hi)                  │
│  src/lib/api.ts  ← typed client, sirf ye badla │
└──────────────┬─────────────────────────────────┘
               │ window.api.customers.list(...) waghera
               │ (preload contextBridge — typed, sirf allowed methods)
┌──────────────▼─────────────────────────────────┐
│  Main process (Electron)                        │
│  electron/ipc/*.ts   — har module ke handlers   │
│  electron/services/  — invoice/stock/balance    │
│                        logic (transactions me)  │
│  electron/db/        — Drizzle schema +         │
│                        migrations + better-sqlite3│
│  File: %APPDATA%\DistribPro\distribpro.db       │
│  (WAL mode, foreign_keys ON)                    │
└─────────────────────────────────────────────────┘
```

Ahem usool:
- `better-sqlite3` sirf **main process** me chalega. Renderer se direct database access nahi hoga (security + Electron ka sahi tareeqa yehi hai).
- Har page ki `supabase.from(...)` calls `api.<module>.<method>(...)` se replace hongi. Pages ke andar ki UI/state logic taqreeban nahi chherti.
- Reports ki calculations renderer me rows kheench kar karne ke bajaye **SQL aggregation** main process me hogi (tez bhi, sahi bhi).
- Supabase se mutalliq sab kuch delete hoga aakhir me: `supabase/` folder, `.env` keys, `@supabase/supabase-js`, `localSupabase.ts`, `offlineDb.ts`, `offlineSchema.ts`, PGlite. `vite.config.ts` ka OFFLINE alias wala khail khatam — ab ek hi build hogi.

## 4. Triggers ka kya hoga (sab se nazuk hissa)

Postgres ke 2 trigger-functions SQLite me nahi chalte. In ka kaam **service layer** me jayega, har kaam ek transaction me — ya to sab hoga ya kuch nahi:

1. **Stock adjust** (`adjust_stock_on_invoice_item`): invoice item add/update/delete → product stock tabdeel. Ye logic `InvoiceService.saveInvoice()` / `deleteInvoice()` ke andar transaction me hoga.
2. **Invoice status sync** (`sync_invoice_status`): paid_amount vs total → `paid / partial / unpaid`. Ye bhi invoice save/payment ke waqt service me calculate hoga.
3. Jo cheezen pehle se app-code me hain (balance recalc, invoice numbering) wo bhi main process service me shift hongi — numbering bhi transaction ke andar, taake duplicate number na bane.

Har service function ke liye pehle test likha jayega (section 6), phir code.

## 5. Phases

### Phase 0 — Faislay aur freeze (½–1 din)
- Money = integer paisa wali tajweez confirm karna; quantity ka format tay karna
- Purani app par feature freeze — migration ke doran naye features nahi
- Ek **golden dataset** banana: purani app se ek mukammal backup file export karna jisme har module ka data ho (customers, invoices, returns, vouchers, stock) — yehi aakhir me sach ka test hoga

### Phase 1 — Foundation (2–3 din)
- Packages: `better-sqlite3`, `drizzle-orm`, `drizzle-kit` (dev), electron ke liye native rebuild ki setting
- 22 tables ka Drizzle schema (section 2 ki conversion ke mutabiq) + pehli migration + seed (default settings + admin/admin123, bilkul pehle jesa)
- Main process me DB setup: WAL, foreign keys, data file `%APPDATA%\DistribPro\distribpro.db` (purani jaga ke qareeb taake customer ko farq mehsoos na ho)
- IPC skeleton + preload typed bridge + renderer me `src/lib/api.ts` — ek chhota module (maslan Settings) end-to-end chala kar pipeline sabit karna

### Phase 2 — Auth, Settings, Permissions, License (1–2 din)
- `AuthContext` aur `localAdmin` ko PGlite se SQLite par laana (login logic pehle se local hai — SHA-256 hash waghera waisa hi, sirf DB badle gi)
- Settings, user permissions, license/activation tables (license key check renderer me localStorage se hota hai — wo waisa hi rahega)

### Phase 3 — Master data / simple CRUD (2–3 din)
- Customers, Suppliers, Products, Routes + customer_routes, Employees, Income Options
- Ye sab simple CRUD hai — pattern ek dafa ban jaye to files jaldi convert hoti hain

### Phase 4 — Transactions, dil ka hissa (4–6 din)
- CustomerInvoices + items, SupplierInvoices + items, SalesReturns, PurchaseReturns, QuickSale, PaymentVouchers, ExpenseVouchers, GatePasses
- Section 4 ki service layer: stock + status + balance + numbering, sab transactions me
- Sab se zyada waqt aur sab se zyada testing yahin lage gi

### Phase 5 — Reports, Dashboard, Printing (2–3 din)
- 10 report pages + Dashboard: SQL aggregations main process me
- Golden dataset par purani vs nayi app ke totals mila kar verify karna (sales, profit/loss, receivable/payable, stock value)
- PrintDocument/PrintModal renderer me hi rehte hain — sirf data ane ka rasta badlega

### Phase 6 — Backup / Restore naye tareeqay se (1–2 din)
- Naya backup = database file ki copy + JSON export (purani format ke qareeb)
- Restore = file replace/import, app restart ke sath
- **Purani backup file ka importer:** customers pehle hi purani (PGlite) app par hain. Un ka data nayi app me lane ka rasta yehi hai — purani app se backup export, nayi app me import. Importer IDs, invoice numbers, balances waisa hi rakhe ga; table counts mila kar report dega
- Backup list me 18 tables hain; `app_users`, `licenses`, `activations`, `backup_history` us me nahi — users naye bane ge (admin se shuru), license activation localStorage par hai wo waisa hi rahega. Ye customer ko pehle se batana hoga

### Phase 7 — QA / acceptance (2–3 din)
- Golden dataset test: ek hi backup purani aur nayi app me — Dashboard totals, har customer/supplier ka balance, har product ka stock, P&L — **sab barabar** hona lazmi
- Service tests (Vitest): stock adjust ke insert/update/delete cases, status ke paid/partial/unpaid cases, return se stock wapas, transaction fail ho to rollback
- Customer ke roz ke flows ki checklist: sale → print → payment → return → report

### Phase 8 — Windows packaging (1–2 din)
- `electron-builder` config: `better-sqlite3` native module ke liye `asarUnpack`, Windows par rebuild verify
- Saaf Windows machine/VM par installer + portable dono test: install → pehla login → data save → app band karke dobara kholna → data mojood
- `DESKTOP_SETUP.md` update; customer upgrade guide (purani app se backup lo → nayi install → import)

### Phase 9 — (Alag, optional) shadcn/ui
- DB migration ke **baad**, alag marhale me. Dono tabdeeliyan ek sath karne se bug kahan se aya, pata nahi chalta
- Ahista ahista: pehle Button/Input/Dialog, phir Table/Select — page by page

## 6. Waqt ka andaza

| Phase | Andaza |
|---|---|
| 0 Faislay + golden dataset | ½–1 din |
| 1 Foundation | 2–3 din |
| 2 Auth/Settings | 1–2 din |
| 3 Master CRUD | 2–3 din |
| 4 Transactions | 4–6 din |
| 5 Reports/Print | 2–3 din |
| 6 Backup/Importer | 1–2 din |
| 7 QA | 2–3 din |
| 8 Packaging | 1–2 din |
| **Kul** | **~16–25 kaam ke din** |

Ye andaza hai, commitment nahi — AI ke sath kaam tez hota hai lekin Phase 4 aur 7 par waqt bachana ghalti hogi, wahan paisa aur stock ka hisaab hai.

## 7. Khatray (risks) aur un ka hal

1. **Native module packaging** (`better-sqlite3` Windows/Electron ABI) — Phase 1 me hi ek test `.exe` bana kar sabit kar lena, aakhir par na chorna.
2. **Paisa float me** — integer paisa wala faisla isiliye Phase 0 me hai; darmiyan me badalna mehnga pare ga.
3. **Trigger logic ki ghalti** = chup chaap ghalat stock/balance. Hal: service tests + golden dataset comparison, bina in ke release nahi.
4. **Customer ka purana data** PGlite folder me para hai — agar customer ne kabhi backup export nahi kiya to import ka asan rasta nahi. Hal: upgrade guide me backup step lazmi, aur release se pehle ek dafa asal customer data par importer test.
5. **Darmiyan me release nahi** — migration aadhi ho to nayi app nahi deni. Purani (PGlite) wali hi shipping rahe gi jab tak Phase 7 pass na ho jaye.

## 8. Migration ke baad kya mile ga

- Ek hi build — online/offline ka dohra jhanjhat khatam
- Database ek file: backup, transfer, restore — sab asan
- PGlite ki ~17 MB WASM aur hath ke shim ki dekh bhaal khatam; queries type-safe (Drizzle) — ghalat column name compile time par pakra jayega
- Reports aur bari lists tez (native SQLite, SQL aggregation)
- Aur haan — jo masle Bolt wale version me aye thy, un ki sab se bari wajah (shim) hi khatam ho jayegi
