@echo off
cd /d "%~dp0"
title DistribPro - Build EXE
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nahi mila. Pehle https://nodejs.org se Node.js LTS install karen.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Pehli dafa setup hai - npm install chal raha hai...
  rem --ignore-scripts: better-sqlite3 ki tayyar .node file package ke andar hi aati hai,
  rem compile ki zaroorat nahi - warna Windows par Visual Studio mangta hai aur install fail ho jata hai.
  call npm install --ignore-scripts
  if errorlevel 1 (
    echo npm install fail ho gaya.
    pause
    exit /b 1
  )
  node node_modules\esbuild\install.js
)
rem Electron ki binary har dafa check hoti hai - pehli dafa download adhoora reh jaye to dobara try hota hai:
if not exist node_modules\electron\path.txt (
  echo Electron download ho raha hai - thora waqt lagega...
  node node_modules\electron\install.js
)
if not exist node_modules\electron\path.txt (
  echo Electron download NAHI ho saka - is liye build nahi ho sakta.
  echo Khud ye command chala kar error dekhen:  node node_modules\electron\install.js
  pause
  exit /b 1
)
echo Tests chal rahe hain...
call npm test
if errorlevel 1 (
  echo Tests FAIL - exe nahi banaya. Upar wali ghalti dekhen.
  pause
  exit /b 1
)
echo Typecheck chal raha hai...
call npm run typecheck
if errorlevel 1 (
  echo Typecheck FAIL - exe nahi banaya.
  pause
  exit /b 1
)
call npm run typecheck:electron
if errorlevel 1 (
  echo Electron typecheck FAIL - exe nahi banaya.
  pause
  exit /b 1
)
echo EXE ban raha hai - electron-builder...
call npm run dist
if errorlevel 1 (
  echo Build FAIL ho gaya.
  pause
  exit /b 1
)
echo.
echo Ho gaya! Installer yahan hai: release\DistribPro-Setup-1.0.0.exe
pause
