OpenMockup Studio - Portable Windows package
============================================

This package is self-contained. You do NOT need to install Node.js, npm, or cloudflared.

Start image mockup mode
-----------------------
Double-click:
  start-openmockup.bat

Use this for PNG, JPG, and WebP mockups. Rendering stays local in your browser.

Start PSD / Photopea mode
-------------------------
Double-click:
  start-openmockup-psd.bat

The package includes cloudflared. PSD mode creates a temporary trycloudflare.com tunnel so Photopea can fetch the selected design asset. The OpenMockup UI stays on http://127.0.0.1:5173.

Do not use PSD mode for confidential artwork unless you understand and accept this data flow.

Stop
----
Close the launcher window. For PSD mode you can also run stop.bat if a previous process remains.

Security / integrity
--------------------
GitHub Releases also publishes a SHA-256 checksum file for the ZIP. You can verify it in PowerShell with:

  Get-FileHash .\OpenMockup-Studio-Windows-x64.zip -Algorithm SHA256

Project:
  https://github.com/SLP-DEV1/OpenMockup-Studio
