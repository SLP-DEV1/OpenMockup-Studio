@echo off
setlocal EnableExtensions
cd /d "%~dp0\..\.."
title OpenMockup Studio - Portable PSD Mode

set "NODE_EXE=%CD%\runtime\node.exe"
set "CLOUDFLARED_BIN=%CD%\tools\cloudflared.exe"
set "PATH=%CD%\runtime;%CD%\tools;%PATH%"

if not exist "%NODE_EXE%" (
  echo [ERROR] Portable Node runtime is missing.
  pause
  exit /b 1
)
if not exist "%CLOUDFLARED_BIN%" (
  echo [ERROR] Bundled cloudflared is missing.
  pause
  exit /b 1
)
if not exist "%CD%\node_modules\vite\bin\vite.js" (
  echo [ERROR] Portable app dependencies are missing.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo  OpenMockup Studio - Portable PSD Mode
echo ==========================================
echo.
echo No Node.js or cloudflared installation is required.
echo A temporary trycloudflare.com URL is created only so Photopea can fetch the selected design asset.
echo The OpenMockup UI itself stays on 127.0.0.1.
echo Keep this window open while using PSD mode.
echo.

"%NODE_EXE%" "%CD%\scripts\dev-public.mjs"

echo.
pause
