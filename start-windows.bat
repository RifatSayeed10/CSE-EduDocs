@echo off
title CSE EduDocs (local)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org
  echo then double-click this file again.
  start https://nodejs.org
  pause
  exit /b 1
)

rem Reuse the AI settings from the older v1.2 folder, if this folder has none yet
if not exist ".env" if exist "..\..\research-archive-v1.2\research-archive\.env" (
  copy "..\..\research-archive-v1.2\research-archive\.env" ".env" >nul
  echo Copied your AI settings from research-archive-v1.2
)

if not exist "node_modules\" (
  echo Installing packages - first time only, takes 1-3 minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Send a screenshot of this window.
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo  Starting CSE EduDocs. The browser opens in a few seconds.
echo  Keep this window open. Close it to stop the site.
echo  Login: admin@cse.pust.ac.bd   Password: adminpassword2026
echo ============================================================
echo.
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:3000"
call npm run dev

echo.
echo The site stopped. If you see an error above, send a screenshot of this window.
pause
