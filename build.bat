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
  call npm install
  if errorlevel 1 (
    echo npm install fail ho gaya.
    pause
    exit /b 1
  )
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
