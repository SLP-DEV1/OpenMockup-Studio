@echo off
setlocal EnableExtensions
cd /d "%~dp0\..\.."
title OpenMockup Studio - Portable Image Mode

set "APP_PORT=5173"
if not "%OPENMOCKUP_PORT%"=="" set "APP_PORT=%OPENMOCKUP_PORT%"
set "APP_URL=http://127.0.0.1:%APP_PORT%/"
set "NODE_EXE=%CD%\runtime\node.exe"
set "VITE_BIN=%CD%\node_modules\vite\bin\vite.js"

if not exist "%NODE_EXE%" (
  echo [ERROR] Portable Node runtime is missing.
  pause
  exit /b 1
)
if not exist "%VITE_BIN%" (
  echo [ERROR] Portable app dependencies are missing.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo  OpenMockup Studio - Portable Image Mode
echo ==========================================
echo.
echo No Node.js installation is required.
echo Open: %APP_URL%
echo Keep this window open while using the app.
echo.

start "" "%APP_URL%"
"%NODE_EXE%" "%VITE_BIN%" --host 127.0.0.1 --port %APP_PORT% --strictPort

echo.
pause
