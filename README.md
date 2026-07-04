# OpenMockup Studio

OpenMockup Studio is a local bulk mockup app for small e-commerce sellers. PSD mockups and design files stay in the browser, are processed through an embedded Photopea iframe, and are exported as PNG files inside a ZIP.

![Screenshot placeholder](docs/screenshot-placeholder.svg)

## MVP Features

- Upload a PSD mockup
- Upload multiple PNG/JPG designs
- Enter the smart object layer name
- Adjust placement with percentage values, rotation, opacity, fit mode, and anchor
- Generate a single preview
- Export all designs as a ZIP batch
- Save and load presets as JSON

## Start

```bash
npm install
npm run dev
```

The app runs locally in the browser. Vite is used for local development and also serves uploaded design assets to Photopea during rendering.

## Photopea rendering during development

Photopea runs inside an iframe from `https://www.photopea.com`. Browser security prevents that iframe from loading design files from `http://127.0.0.1` or `http://localhost`. For Smart Object replacement, the design asset must be reachable through a public HTTPS URL with CORS enabled.

The easiest development command is:

```bash
npm run dev:public
```

This starts a temporary Cloudflare Tunnel and starts Vite with `OPENMOCKUP_PUBLIC_BASE_URL` set automatically. Open the shown `https://...trycloudflare.com` URL in your browser.

If you start the tunnel manually, set the public base URL before starting Vite:

Windows PowerShell:

```powershell
$env:OPENMOCKUP_PUBLIC_BASE_URL="https://your-public-tunnel.example"
npm run dev
```

Windows CMD:

```cmd
set OPENMOCKUP_PUBLIC_BASE_URL=https://your-public-tunnel.example&& npm run dev
```

macOS / Linux:

```bash
OPENMOCKUP_PUBLIC_BASE_URL=https://your-public-tunnel.example npm run dev
```

## Folder Structure

```text
src/
  components/
  lib/
    export/
    photopea/
  types/
```

## Workflow

1. Upload a PSD mockup.
2. Upload one or more PNG/JPG designs.
3. Enter the smart object layer name.
4. Adjust placement.
5. Use "Generate Preview" for a test run.
6. Use "Export Batch" to create one PNG per design and download all results as a ZIP.

## Photopea Notes

OpenMockup Studio uses Photopea's public API through `postMessage`. The Photopea iframe is kept offscreen, but it still loads at a real size because Photopea is more reliable that way than inside a tiny hidden frame.

## GIF Placeholder

![Workflow GIF placeholder](docs/workflow-placeholder.svg)

## MVP Limits

- Smart object replacement requires the named layer to exist in the PSD.
- PSD files with deeply nested layers or locked smart objects may need additional handling.
- Batch processing runs serially on purpose so Photopea remains stable and the browser is not overloaded.
