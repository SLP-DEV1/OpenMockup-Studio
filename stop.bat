@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OpenMockup Studio - Stop
cd /d "%~dp0"

set "APP_PORT=5173"
if not "%OPENMOCKUP_PORT%"=="" set "APP_PORT=%OPENMOCKUP_PORT%"

echo.
echo ==========================================
echo  OpenMockup Studio - Stop
echo ==========================================
echo.

set "STOPPED=0"

if exist ".openmockup-pids.bat" (
  call ".openmockup-pids.bat"
  if defined OPENMOCKUP_VITE_PID (
    echo [INFO] Stopping Vite process !OPENMOCKUP_VITE_PID!...
    taskkill /F /T /PID !OPENMOCKUP_VITE_PID! >nul 2>nul
    if not errorlevel 1 set "STOPPED=1"
  )
  if defined OPENMOCKUP_TUNNEL_PID (
    echo [INFO] Stopping Cloudflare tunnel process !OPENMOCKUP_TUNNEL_PID!...
    taskkill /F /T /PID !OPENMOCKUP_TUNNEL_PID! >nul 2>nul
    if not errorlevel 1 set "STOPPED=1"
  )
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%APP_PORT% .*LISTENING"') do (
  echo [INFO] Stopping process %%P on port %APP_PORT%...
  taskkill /F /T /PID %%P >nul 2>nul
  if not errorlevel 1 set "STOPPED=1"
)

if "%STOPPED%"=="0" (
  echo [INFO] No OpenMockup Studio server was found.
) else (
  echo [OK] Server/tunnel stopped.
)

del /q ".openmockup-pids.bat" >nul 2>nul
del /q ".openmockup-public-url.txt" >nul 2>nul

echo.
pause
