# DistribPro SQLite Migration — Phase 0 Decisions

Date: 2026-11-02 · Branch: `sqlite-migration` (baseline commit `54d0557` = original Bolt/PGlite version, untouched on `main`)
Plan: `../SQLITE_MIGRATION_PLAN.md`

## D1 — Sirf offline (user ka faisla, 2026-11-02)
App sirf offline desktop rahe gi. Supabase/online build khatam hoga jab migration mukammal ho.
Tab tak purani PGlite wali app hi shipping version hai — darmiyan me koi release nahi.

## D2 — Money: integer paisa (minor units)
Tamam money columns SQLite me **integer paisa** me store honge: Rs 150.50 → `15050`.
Wajah: SQLite me decimal type nahi hota; `real` (float) accounting me rounding ki ghaltiyan deta hai
(maslan 0.1 + 0.2 ≠ 0.3). Integer par hisaab hamesha exact hota hai.
- Conversion sirf data layer (main process services) me hogi: DB integer paisa, UI hamesha rupees
  (string/number) me baat kare gi, taake pages me har jagah /100 na likhna pare.
- Money columns (33 `numeric(12,2)` me se ye): customers/suppliers ke `opening_balance`,
  `current_balance`; products ke `purchase_price`, `sale_price`; dono invoices ke
  `subtotal, discount, tax, total, paid_amount, balance`; dono invoice items ke
  `unit_price, total`; `payment_vouchers.amount`; `expense_vouchers.amount`;
  `gate_passes.total_amount`; `employees.salary`; `salary_payments.amount`;
  `income_options.amount`; `salesman_targets.target_amount`.

## D3 — Quantity: integer milli-units (×1000)
`products.stock_quantity`, `products.reorder_level`, aur dono invoice items ki `quantity`
**integer milli-units** me: 2.5 kg → `2500`. UI me step 0.01 hai, ×1000 us se zyada precision deta hai,
aur stock ka hisaab bhi float-free rehta hai.

## D4 — Percent: integer ×100
`customer_invoice_items.discount_percent`, `supplier_invoice_items.discount_percent`,
`settings.tax_rate` **integer ×100** me: 10.5% → `1050`.

## D5 — Baqi type conversions
- `uuid` → `text` primary key, naye IDs `crypto.randomUUID()` se. Purane IDs import me waisay hi text ban kar aayenge.
- `date` aur `timestamptz` → `text` (ISO string). UI pehle hi dates ko string samajhti hai.
- `boolean` → Drizzle `integer` with `mode: 'boolean'`.
- `user_permissions.permissions` (Postgres `text[]`) → `text` with `mode: 'json'` (string array).
- `backup_history.table_counts` (`jsonb`) → `text` with `mode: 'json'`.
- Jo pehle se integer hain (`routes.day_of_week`, `sort_order`, `backup_history.size_bytes`,
  `licenses.max_devices`) wo integer hi rahenge.

## D6 — Stock logic: trigger PORT NAHI hoga, sahi logic likha jayega ⚠️
Phase 0 ki sab se ahem finding: **maujooda Postgres stock trigger me bug hai** —
online migration (`20261017075401`) aur offline copy, dono me ek jesa.

Trigger INSERT par sahi hai, lekin **DELETE par sign ulta hai** aur UPDATE par sirf
nayi quantity gin ta hai, purani nahi. App invoice edit par delete-then-reinsert karti hai
(`CustomerInvoices.tsx:258`, `SupplierInvoices.tsx:180`) aur invoice delete par bhi
pehle items delete hote hain (`CustomerInvoices.tsx:316`). Nateeja:

| Amal | Hona chahiye | Trigger karta hai |
|---|---|---|
| Sale item qty 5 delete (edit/delete par) | stock **+5** wapas | stock **−5** aur |
| Purchase item qty 5 delete | stock **−5** | stock **+5** aur |
| Sales-return item delete | stock **−qty** | stock **+qty** aur |
| Purchase-return item delete | stock **+qty** | stock **−qty** aur |

Misal: sale 5 ki, phir edit karke 8 kar di → stock asal −8 ke bajaye −18 ho jata hai.
App code me is ki koi manual talafi bhi nahi hai (grep se verify: `stock_quantity`
sirf product form aur reports me likha/padha jata hai).

**Faisla:** Nayi service layer me stock ka durust delta formula hoga, har invoice save/delete
ek transaction me:
`stock_delta = −(naya_signed_qty) + (purana_signed_qty)`, jahan signed qty document type se hai:
sale −, sales-return +, purchase +, purchase-return −.
Phase 4 me is ke unit tests pehle likhe jayenge. **Ye bug shayad customer ke "maslon"
me se ek bara masla hai.**

## D7 — Invoice status: maujooda rawaiya hi rahe ga
Maujooda trigger: `balance <= 0` → `paid`, warna `unpaid`. UI me `partial` status istemal
hi nahi hota (grep verify) — is liye nayi service bhi yehi do status rakhe gi.
Partial payment par invoice `unpaid` hi dikhe ga, jesa ab hai. Alag `partial` banana ho to
wo migration ke baad ki alag tabdeeli hogi.

## D8 — Data layer ki sarhad (API contract)
Renderer ko paisa/quantity ke integer units ka pata nahi hoga. Services (main process)
rupees ↔ paisa aur units ↔ milli conversion apne andar karengi; `src/lib/api.ts` ke
types purane `src/lib/types.ts` jese hi rahenge taake pages me tabdeeli sirf data-call
wali line par ho.

## D9 — Golden dataset
`migration/golden/golden-backup.json` — purani backup format me ek chhota, mukammal,
hath se ginna hua dataset (har module ka data). `migration/golden/expected-totals.json`
me us ke ginne hue totals hain. Phase 5/7 me nayi app ke totals inse milaye jayenge.
Dataset ke andar ke hisaab: products ki final stock un transactions se nikali gayi hai
jo dataset me hain, **durust** stock logic ke mutabiq (D6) — purani app ka stock is
dataset par ghalat niklega, aur ye farq hi D6 ke bug ka saboot/test hai.

## D10 — Feature freeze
Migration ke doran purani app par naye features nahi banege. Bug fix lazmi ho to
pehle `main` (baseline) par, phir migration branch me usi logic ko port karna hoga.

## D11 — License registry ka quirk (Phase 2 me note kiya gaya, semantics change nahi)
License key ki verification hamesha renderer me hoti hai (`src/lib/license.ts`,
offline checksum) aur wo `licenses` table kabhi nahi parhti — ActivationScreen bhi
database ko hath nahi lagati. Is liye admin ka kisi key ko "Disable" karna asal me
customer ke device par **koi asar nahi dalta**, halanke UI ka delete-confirm text
ulta dawa karta hai ("Devices using it will stop working on next check").
Phase 2 me registry (list/create/toggle/delete) jesi thi wesi hi SQLite par port
hui hai. Asal disable-works karna ho to wo migration ke baad ki alag feature hai
(device ko kabhi table check karna pare ga, jo "fully offline key" wale dawe se
takrata hai) — faisla baad me hoga.

## D12 — invoice_type ki spelling: hyphen canonical hai (Phase 7 me pakra gaya)
Purani app me do spellings chalti theen: **UI hamesha hyphen** likhti thi
('sales-return', 'purchase-return' — SalesReturns/PurchaseReturns pages,
recalcCustomerBalance, reports), lekin **database trigger underscore**
check karta tha ('sales_return', 'purchase_return' — migration
20261017075401 + offlineSchema copy). Nateeja: UI se bani hui sales return
par trigger ELSE branch me ja kar **stock bilkul wapas nahi karta tha**, aur
purchase return par bhi stock kam nahi hota tha — returns sirf balance me
dikhti theen, stock me kabhi nahi. Ye D6 ke sath mil kar purani app ke stock
garbar ki doosri bari wajah hai.
**Faisla:** canonical spelling hyphen wali hai (asal customer data bhi UI se
hyphen me hi likha gaya hoga). Importer (backupService) purani backup files
me agar underscore wali type mile to import par hyphen me normalize kar
deta hai. Golden dataset bhi hyphen par regenerate kar diya gaya hai
(Phase 0 me wo trigger file ko dekh kar underscore me ban gaya tha).
