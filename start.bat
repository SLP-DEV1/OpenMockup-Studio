@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OpenMockup Studio - Start
cd /d "%~dp0"

set "APP_PORT=5173"
if not "%OPENMOCKUP_PORT%"=="" set "APP_PORT=%OPENMOCKUP_PORT%"
set "APP_URL=http://127.0.0.1:%APP_PORT%/"

echo.
echo ==========================================
echo  OpenMockup Studio
echo ==========================================
echo.
echo Full PSD/Photopea mode needs a temporary public HTTPS asset URL.
echo This launcher starts a Cloudflare tunnel for Photopea assets.
echo The app itself opens locally at %APP_URL%
echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Start this file from the OpenMockup Studio project folder.
  echo.
  pause
  exit /b 1
)

REM --------------------------------------------------
REM Node.js check (optional auto-install via winget)
REM --------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [INFO] Node.js was not found.
  echo [INFO] Trying to install Node.js LTS with winget...
  echo.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] winget is not available on this Windows installation.
    echo Please install Node.js LTS manually, then run this file again:
    echo https://nodejs.org/
    echo.
    start "" "https://nodejs.org/"
    pause
    exit /b 1
  )

  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo [ERROR] Automatic Node.js installation failed.
    echo Please install Node.js LTS manually, restart this terminal, and run this file again:
    echo https://nodejs.org/
    echo.
    start "" "https://nodejs.org/"
    pause
    exit /b 1
  )

  echo.
  echo [INFO] Node.js was installed. Close this window and run start.bat again.
  echo.
  pause
  exit /b 0
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please restart this terminal after installing Node.js, then run start.bat again.
  echo.
  pause
  exit /b 1
)

REM --------------------------------------------------
REM cloudflared check (optional auto-install via winget)
REM --------------------------------------------------
set "CLOUDFLARED_FOUND=0"
where cloudflared >nul 2>nul
if not errorlevel 1 set "CLOUDFLARED_FOUND=1"

if exist "tools\cloudflared.exe" (
  set "CLOUDFLARED_FOUND=1"
  set "CLOUDFLARED_BIN=%CD%\tools\cloudflared.exe"
)

if "%CLOUDFLARED_FOUND%"=="0" (
  echo [INFO] cloudflared was not found.
  echo [INFO] Trying to install Cloudflare Tunnel with winget...
  echo.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] winget is not available, so cloudflared cannot be installed automatically.
    echo Install cloudflared manually or use start-local.bat for PNG/JPG mockups only:
    echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    pause
    exit /b 1
  )

  winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo [ERROR] Automatic cloudflared installation failed.
    echo Install cloudflared manually or use start-local.bat for PNG/JPG mockups only.
    echo.
    pause
    exit /b 1
  )

  echo.
  echo [INFO] cloudflared was installed. Run start.bat again.
  echo.
  pause
  exit /b 0
)

REM --------------------------------------------------
REM Kill stale processes on the target port
REM --------------------------------------------------
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%APP_PORT%^|findstr LISTENING') do (
  echo [WARN] Port %APP_PORT% is already in use by PID %%P. Stopping...
  taskkill /F /PID %%P >nul 2>nul
)

timeout /t 2 /nobreak >nul

REM --------------------------------------------------
REM Install dependencies if needed
REM --------------------------------------------------
set "NEED_INSTALL=0"
if not exist "node_modules\vite\bin\vite.js" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo [INFO] Installing dependencies. This is only needed the first time or after updates.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Check the npm error above and run start.bat again.
    echo.
    pause
    exit /b 1
  )
) else (
  echo [INFO] Dependencies already installed.
)

REM --------------------------------------------------
REM Cleanup old runtime files
REM --------------------------------------------------
del /q ".openmockup-public-url.txt" >nul 2>nul
del /q ".openmockup-pids.bat" >nul 2>nul

echo.
echo [INFO] Starting OpenMockup Studio in public HTTPS mode.
echo [INFO] The browser will open the local app URL automatically.
echo [INFO] Keep this window open while using the app.
echo [INFO] To stop the server and tunnel, close this window or run stop.bat.
echo.

call npm run dev:public

if errorlevel 1 (
  echo.
  echo [ERROR] OpenMockup Studio stopped with an error.
  echo Check the output above for details.
  echo.
) else (
  echo.
  echo [INFO] OpenMockup Studio has stopped.
  echo.
)

pause
