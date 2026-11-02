@echo off
setlocal
title DistribPro - Build Installer
echo.
echo  ===== DistribPro Windows Installer bana rahe hain =====
echo.
cd /d "%~dp0"

REM ---- 1. Node.js check ----
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js install nahi hai.
  echo      https://nodejs.org se "LTS" version download karke install karein,
  echo      phir computer restart karke dobara ye file chalayen.
  echo.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 (
  echo.
  echo  [X] Node.js purana hai ^(version %NODE_MAJOR%^). Kam az kam 18 chahiye, 20 ya 22 LTS behtar hai.
  echo      https://nodejs.org se naya LTS install karein.
  echo.
  pause
  exit /b 1
)

REM ---- 2. Packages (sirf pehli dafa ya jab missing hon) ----
if not exist "node_modules\.bin\vite.cmd" (
  echo  [*] Pehli dafa packages install ho rahe hain ^(internet chahiye, 2-5 minute^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [X] npm install fail ho gaya. Internet check karein aur dobara chalayen.
    echo      Agar phir bhi masla ho to "node_modules" folder delete karke dobara try karein.
    pause
    exit /b 1
  )
)

REM ---- 3. Electron ka program (kabhi kabhi npm isay download nahi karta) ----
if not exist "node_modules\electron\dist\electron.exe" (
  echo  [*] Electron ki dependencies check ho rahi hain...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [X] Dependencies install nahi huin. Upar wala error message bhej dein.
    pause
    exit /b 1
  )
  echo  [*] Electron install ho raha hai...
  call node node_modules\electron\install.js
  if errorlevel 1 (
    echo.
    echo  [X] Electron install fail hua. Upar wala error message bhej dein.
    pause
    exit /b 1
  )
  if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo  [X] Electron ki file nahi mili. Upar wala output bhej dein.
    pause
    exit /b 1
  )
)

REM ---- 4. Purani build saaf karna ----
if exist "release" rmdir /s /q "release"

REM ---- 5. Installer build (pehli dafa 5-10 minute, internet chahiye) ----
set CSC_IDENTITY_AUTO_DISCOVERY=false
echo  [*] Installer ban raha hai, intezar karein...
call npm run dist
if errorlevel 1 (
  echo.
  echo  [X] Installer build fail hua. Upar wala error message copy karke bhej dein.
  pause
  exit /b 1
)

echo.
echo  ===== Mukammal! =====
echo  "release" folder me ye files hain:
echo    - DistribPro-Setup-1.0.0.exe     (customer ko ye dein - installer)
echo    - DistribPro-Portable-1.0.0.exe  (bina install ke chalne wali)
echo.
start "" explorer "release"
pause
exit /b 0
