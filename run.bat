@echo off
cd /d "%~dp0"
title DistribPro - Run
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
  rem Electron aur esbuild ki binary files in ke apne install script se aati hain, wo alag se chala rahe hain:
  node node_modules\electron\install.js
  node node_modules\esbuild\install.js
)
echo DistribPro chal raha hai - Electron app build ho kar khule gi...
call npm run electron:dev
pause
