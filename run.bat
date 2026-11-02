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
  call npm install
  if errorlevel 1 (
    echo npm install fail ho gaya.
    pause
    exit /b 1
  )
)
echo DistribPro chal raha hai - Electron app build ho kar khule gi...
call npm run electron:dev
pause
