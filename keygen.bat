@echo off
setlocal
title DistribPro - License Key
cd /d "%~dp0"
if not exist "node_modules\.bin\vite.cmd" (
  echo Pehle run.bat ek dafa chalayen ^(packages install karne ke liye^).
  pause
  exit /b 1
)
echo.
echo  ===== DistribPro License Key Generator =====
echo.
set /p CUST=Customer ka naam: 
set /p DAYS=Kitne din ke liye? (0 = lifetime): 
set /p DEVS=Kitne computers? (0 = unlimited, 1-9): 
if "%DAYS%"=="" set DAYS=0
if "%DEVS%"=="" set DEVS=1
call node scripts\keygen.mjs "%CUST%" %DAYS% %DEVS%
pause
