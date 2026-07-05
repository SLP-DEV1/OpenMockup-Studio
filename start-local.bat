@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OpenMockup Studio - Local Image Mode
cd /d "%~dp0"

set "APP_PORT=5173"
if not "%OPENMOCKUP_PORT%"=="" set "APP_PORT=%OPENMOCKUP_PORT%"
set "APP_URL=http://127.0.0.1:%APP_PORT%/"

echo.
echo ==========================================
echo  OpenMockup Studio - Local Image Mode
echo ==========================================
echo.
echo This mode is for PNG/JPG/WebP image mockups.
echo PSD/Photopea mode needs start.bat because it requires a public HTTPS tunnel.
echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js LTS first:
  echo https://nodejs.org/
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Restart this terminal after installing Node.js.
  pause
  exit /b 1
)

set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\.package-lock.json" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo [INFO] Starting local server on %APP_URL%
echo [INFO] Keep this window open while using the app.
echo.
start "" "%APP_URL%"
call npm run dev -- --host 127.0.0.1 --port %APP_PORT% --strictPort

echo.
pause
