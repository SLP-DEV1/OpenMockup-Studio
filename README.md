# OpenMockup Studio

> Create complete product-mockup batches in your browser — from flat images or PSD Smart Objects.

[![CI](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

OpenMockup Studio is a free, browser-based batch mockup tool for small shops, artists, print businesses, and marketplace sellers. Load one or more mockups, add multiple designs, adjust their placement visually, and export every combination as a ZIP file.

![OpenMockup Studio interface](docs/screenshot.png)

## Why OpenMockup Studio?

- **Batch-first workflow:** export every mockup/design combination in one run.
- **PSD and image support:** use PSD Smart Objects or flat PNG, JPG, and WebP mockups.
- **Visual placement:** move, resize, rotate, anchor, and fit designs directly in the editor.
- **Marketplace-ready output:** crop, resize, watermark, rename, and convert exported files.
- **Local image rendering:** flat image mockups stay in your browser.
- **No account required:** run the project locally or host it yourself.

## Quick start

### Windows

Download or clone the repository, then double-click one of these files:

| Launcher | Use it for |
| --- | --- |
| `start-local.bat` | PNG, JPG, and WebP mockups; no public tunnel |
| `start.bat` | Full PSD mode with Photopea and a temporary HTTPS asset tunnel |
| `stop.bat` | Stop the local server and tunnel |

The app opens at [http://127.0.0.1:5173](http://127.0.0.1:5173). Keep the launcher window open while you work.

### Developers

Requirements: Node.js 20 or newer and npm 10 or newer.

```bash
git clone https://github.com/SLP-DEV1/OpenMockup-Studio.git
cd OpenMockup-Studio
npm ci
npm run dev
```

Then open the URL shown by Vite, normally `http://127.0.0.1:5173`.

For PSD support with a temporary Cloudflare Tunnel, install [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and run:

```bash
npm run dev:public
```

## How it works

1. Add one or more PSD, PNG, JPG, or WebP mockups.
2. Add your PNG, JPG, or WebP designs.
3. Select a mockup and design.
4. Adjust placement, scale, rotation, fit, and opacity.
5. Preview the result.
6. Export all combinations as a ZIP.

### Rendering modes

| Capability | Flat image mode | PSD mode |
| --- | ---: | ---: |
| PNG/JPG/WebP mockups | Yes | — |
| PSD Smart Objects | — | Yes |
| Rendering location | Browser Canvas | Photopea iframe |
| Public asset URL required | No | Yes |
| Batch ZIP export | Yes | Yes |

Flat image mockups are rendered entirely with the browser Canvas API. PSD rendering loads Photopea in an iframe and temporarily exposes the selected design through the local `__openmockup/design` endpoint so Photopea can retrieve it.

## Privacy and PSD mode

Flat image rendering stays in your browser. PSD mode is different: Photopea must be able to download the selected design from a public HTTPS address. With `npm run dev:public` or `start.bat`, OpenMockup Studio creates a temporary Cloudflare Tunnel for that purpose.

Do not use PSD mode for confidential assets unless you understand and accept this data flow. OpenMockup Studio is not affiliated with Photopea, and PSD support depends on Photopea's public iframe/API behavior.

## Hosting

### Static hosting

Static hosting works for flat image mockups only. PSD mode requires a server-side endpoint for temporary design assets. If the app is hosted below a subpath, configure Vite's public base path for that deployment.

### VPS or server deployment

Build the app and run Vite's preview server behind a reverse proxy such as Caddy or Nginx:

```bash
npm ci
npm run build
npm run preview
```

Example environment variables:

```env
OPENMOCKUP_PUBLIC_BASE_URL=https://openmockup.example.com
OPENMOCKUP_MAX_DESIGN_MB=50
OPENMOCKUP_DESIGN_TTL_MS=1800000
OPENMOCKUP_ALLOW_PUBLIC_UPLOADS=1
```

Public uploads are disabled by default. Enable them only when the deployment is protected by authentication, a private network, or equivalent access controls. Proxy the public domain to the local preview server, normally `http://127.0.0.1:4173`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development mode |
| `npm start` | Start on `127.0.0.1:5173` |
| `npm run dev:public` | Start with a temporary Cloudflare Tunnel |
| `npm run typecheck` | Run TypeScript checks |
| `npm run typecheck:strict` | Include unused-code checks |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove dependencies, builds, and local caches |

## PSD troubleshooting

### Photopea needs a public HTTPS design URL

Start the app with `start.bat` or `npm run dev:public`. Localhost URLs cannot be fetched by Photopea.

### A `trycloudflare.com` address shows `DNS_PROBE_FINISHED_NXDOMAIN`

Open the app at `http://127.0.0.1:5173`, not at the tunnel address. Temporary tunnel URLs expire when the launcher stops. Run `stop.bat`, then `start.bat` to create a new one.

### A Smart Object is not detected

- Confirm that the PSD contains a Smart Object layer.
- Unlock deeply nested or locked layers where possible.
- Give the intended layer a descriptive name.
- Simplify unusual PSD structures before retrying.

PSD batches run serially to keep the Photopea session stable.

## Project structure

```text
src/components/       React interface components
src/lib/config/       Product and export profiles
src/lib/export/       Conversion, naming, ZIP, and download helpers
src/lib/photopea/     Photopea bridge and rendering scripts
src/lib/              Image rendering and PSD detection
scripts/              Local launcher and cleanup helpers
docs/                 Documentation assets
```

## Contributing

Issues and pull requests are welcome. Before submitting a change, run:

```bash
npm ci
npm run typecheck:strict
npm run build
```

Do not commit dependencies, build output, exports, private mockups, PSD files, or runtime tunnel files.

## Roadmap

- Four-point perspective transforms for flat image mockups
- Better masking for PNG, JPG, and WebP mockups
- More product profiles and placement defaults
- Faster batch previews and improved PSD error recovery
- Optional self-hosted asset service and authentication

## License

Released under the [MIT License](LICENSE).
