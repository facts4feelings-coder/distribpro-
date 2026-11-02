# DistribPro

Distribution Management System — Windows desktop app (100% offline).
Customers, invoices, stock, returns, vouchers, gate passes, salaries, reports.

---

## Asaan tareeqa (Windows)

### 1. Ek dafa ki tayyari

1. **Node.js** install karein: <https://nodejs.org> se **LTS** version (20 ya 22). Install ke baad computer restart kar dein.
2. **Project download karein** — do me se koi ek tareeqa:
   - **Bina Git ke (sab se asaan):** GitHub page par hare **Code** button → **Download ZIP** → ZIP ko kisi folder me *Extract* karein (maslan `C:\DistribPro`).
     ZIP ke andar se direct na chalayen, pehle Extract zaroor karein.
   - **Git se:** [Git for Windows](https://git-scm.com/download/win) install karein, phir:
     ```
     git clone https://github.com/facts4feelings-coder/distribpro-.git C:\DistribPro
     ```
     Note: repo ke naam ke aakhir me `-` (dash) hai — `distribpro-`.

> Project ko **chhote, saade path** par rakhen (maslan `C:\DistribPro`). OneDrive / Desktop / bohat lambe folder names se masle aate hain.

### 2. App chalana

`run.bat` par **double-click** karein.

- Pehli dafa ye packages download karega (internet chahiye, 2–5 minute).
- Phir app khul jayegi. Baad me har dafa jaldi khulegi.

### 3. Customer ke liye installer banana

`build.bat` par **double-click** karein. Mukammal hone par `release` folder khul jayega:

| File | Kis liye |
|---|---|
| `DistribPro-Setup-1.0.0.exe` | Customer ko ye dein — Install → Next → Finish |
| `DistribPro-Portable-1.0.0.exe` | Bina install ke chalne wali |

### 4. License key banana

App pehli dafa license key maangti hai. Key banane ke liye `keygen.bat` chalayen (customer ka naam, din, computers ki tadad dein).
Ye wohi key banata hai jo app ke andar *Settings → License Key Generator* banata hai.

### 5. Pehla login

- Username: `admin`
- Password: `admin123`

Login ke foran baad *Settings → Admin Users* se password badal dein.

---

## Masle aur hal

| Masla | Hal |
|---|---|
| "Node.js install nahi hai" | nodejs.org se LTS install karein, computer restart karein |
| `npm install` fail | Internet check karein. `node_modules` folder delete karke `run.bat` dobara chalayen |
| App khuli lekin khali / safed screen | **F12** dabayen → *Console* me laal error copy karke bhej dein. **F5** = reload |
| Build ke doran antivirus ne rok diya | Project folder ko antivirus ki exclusion list me daal dein |

## Developers ke liye

```
npm install
npm run build:offline     # web bundle (offline mode)
npm start                 # Electron me chalana (pehle build zaroori)
npm run dist              # Windows installer (release/)
npm run test:db           # offline database self-test
npm run typecheck
npm run keygen -- "Customer" 365 1
```

Data customer ke PC par app ke apne folder (`%APPDATA%\DistribPro`) me save hota hai. Backup/Restore *Settings* se.

Aage ka plan: [SQLITE_MIGRATION_PLAN.md](SQLITE_MIGRATION_PLAN.md) · Technical notes: [DESKTOP_SETUP.md](DESKTOP_SETUP.md)
