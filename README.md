# OpenMockup Studio

> **Open-source batch mockup generator for product sellers and creators.** Combine many designs with many mockups, adjust placement visually, and export every result as a ZIP.

[![CI](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml)
[![Demo](https://img.shields.io/badge/Try%20the%20demo-GitHub%20Pages-222222?logo=github)](https://slp-dev1.github.io/OpenMockup-Studio/)
[![Windows Release](https://img.shields.io/badge/Windows-Portable%20Download-0078D4?logo=windows)](https://github.com/SLP-DEV1/OpenMockup-Studio/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)](https://react.dev/)

**Free · local-first · no account · no subscription**

### [▶ Try OpenMockup Studio in your browser](https://slp-dev1.github.io/OpenMockup-Studio/)

The public demo needs no installation and supports PNG, JPG, and WebP mockups. Click **Try sample project** to see it working immediately. Files stay in the browser. PSD Smart Objects require the local version because that workflow uses Photopea and a temporary public asset URL.

![OpenMockup Studio interface](docs/screenshot.png)

OpenMockup Studio is built for Etsy, WooCommerce, marketplace sellers, artists, print shops, and anyone tired of producing product mockups one by one. Load mockups, add designs, fine-tune placement, preview the result, then generate the full batch.

> If OpenMockup Studio saves you manual mockup work, a ⭐ on GitHub helps more creators find it.

## Why use it?

- **Batch-first:** create every mockup/design combination in one run.
- **PSD Smart Object support:** automate compatible PSD templates through Photopea.
- **Flat image support:** use PNG, JPG, and WebP mockups directly in the browser.
- **4-corner perspective:** warp artwork onto angled signs, frames, screens, packaging, and other surfaces.
- **Visual placement editor:** move, scale, rotate, anchor, fit, adjust opacity, or drag perspective corners.
- **Marketplace-ready exports:** crop, resize, watermark, rename, convert, and ZIP results.
- **Collision-safe batches:** duplicate output names are preserved automatically instead of being overwritten.
- **Bounded batch gallery:** large exports do not keep every rendered image alive after ZIP creation.
- **Local-first workflow:** flat-image rendering stays in your browser.
- **Self-hostable:** no account or hosted service is required.

## Quick start

### Zero-install browser demo

Open the [GitHub Pages demo](https://slp-dev1.github.io/OpenMockup-Studio/) and click **Try sample project**, or add your own PNG, JPG, or WebP mockup plus one or more designs. Preview, perspective editing, and batch export work directly in the browser.

The demo intentionally disables PSD uploads. Use the Windows package or developer setup below for PSD Smart Objects.

### Windows: portable release — recommended

1. Open [GitHub Releases](https://github.com/SLP-DEV1/OpenMockup-Studio/releases/latest).
2. Download `OpenMockup-Studio-Windows-x64.zip` and optionally its `.sha256` checksum.
3. Extract the ZIP.
4. Double-click the launcher you need:

| Launcher | Use it for |
| --- | --- |
| `start-openmockup.bat` | PNG, JPG, and WebP mockups; local image-mode server |
| `start-openmockup-psd.bat` | PSD mode with Photopea and an isolated temporary design-asset tunnel |
| `stop.bat` | Stop a remaining local server/tunnel process |

The portable package includes its own runtime, dependencies, and pinned PSD-mode tunnel helper. **You do not need to install Node.js, npm, or cloudflared.** The app opens at `http://127.0.0.1:5173`; keep the launcher window open while you work.

### Developers / source install

```bash
git clone https://github.com/SLP-DEV1/OpenMockup-Studio.git
cd OpenMockup-Studio
npm ci
npm run dev
```

Source development requires Node.js 20.19+ (Node 22 recommended). For PSD support with a temporary Cloudflare Tunnel, install `cloudflared` and run:

```bash
npm run dev:public
```

`dev:public` keeps Vite on localhost and starts a second, minimal localhost asset server. Cloudflare tunnels only that second port. The browser posts designs to the local Vite proxy; Vite forwards them to the isolated server with a per-run random token. Photopea receives only the resulting temporary public design URL.

## Typical workflow

1. Add one or more PSD, PNG, JPG, or WebP mockups.
2. Add your PNG, JPG, or WebP designs.
3. Select a mockup and a design.
4. Adjust placement, scale, rotation, fit, opacity, or enable 4-corner perspective for flat-image mockups.
5. Preview the result.
6. Export all combinations as a ZIP.

## Rendering modes

| Capability | Flat image mode | PSD mode |
| --- | ---: | ---: |
| PNG/JPG/WebP mockups | Yes | — |
| PSD Smart Objects | — | Yes |
| 4-corner perspective | Yes | — |
| Rendering | Browser Canvas | Photopea iframe |
| Public asset URL needed | No | Yes, temporary design asset only |
| App UI publicly tunneled | No | No |
| Batch ZIP export | Yes | Yes |
| Account required | No | No |
| Public demo | Yes | No |

### Privacy note

Flat image rendering stays in the browser. That includes the public GitHub Pages demo: there is no upload backend in the static demo build.

PSD mode is different: Photopea must be able to download the selected transformed design from a public HTTPS address. `start-openmockup-psd.bat` or `npm run dev:public` creates a temporary Cloudflare Tunnel **only to an isolated design-asset server**. The OpenMockup Studio UI and Vite server remain bound to localhost and are not routed through that tunnel.

The isolated server stores temporary images in memory, limits their size and lifetime, and exposes only unpredictable read URLs. The browser-to-asset upload path stays local and is authenticated with a random per-run token between local processes.

Do not use PSD mode for confidential assets unless you understand and accept that the transformed design must be retrievable by Photopea over the temporary public URL. OpenMockup Studio is not affiliated with Photopea.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development mode |
| `npm start` | Start on `127.0.0.1:5173` |
| `npm run dev:public` | Start PSD mode with an isolated temporary design-asset tunnel |
| `npm run typecheck` | Run TypeScript checks |
| `npm run typecheck:strict` | Include unused-code checks |
| `npm test` | Run the automated test suite once |
| `npm run build` | Type-check and create a production build |
| `npm run build:demo` | Build the flat-image-only static demo |
| `npm run check` | Run strict typecheck, tests, and production build |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove dependencies, builds, and local caches |

## Hosting

Flat image mode can be hosted as a static Vite build. The repository includes a GitHub Pages workflow that builds in `demo` mode, uses the repository subpath as Vite's base path, omits the temporary PSD design-server plugin, and deploys `dist/` as a Pages artifact.

For ordinary local PSD use, prefer `npm run dev:public` rather than exposing the Vite server itself. A production/server deployment that offers PSD assets to remote users needs a deliberately authenticated asset service with rate limits instead of simply setting `OPENMOCKUP_ALLOW_PUBLIC_UPLOADS=1` on an Internet-facing Vite instance.

Example environment variables are documented in [`.env.example`](.env.example).

## Troubleshooting PSD mode

**Photopea cannot fetch the design:** use `start-openmockup-psd.bat` or `npm run dev:public`. Do not create a tunnel directly to the Vite UI port.

**A `trycloudflare.com` address expired:** stop the previous PSD-mode process and start it again. Continue using the OpenMockup UI at `http://127.0.0.1:5173`; the temporary public URL is for design assets, not for browsing the app.

**A Smart Object is not detected:** verify that the PSD/PSB really contains a Smart Object, unlock unusual nested layers where possible, and simplify highly unusual document structures before retrying.

PSD batches run serially to keep the Photopea session stable.

## Project health

The repository uses strict TypeScript checks, Vitest, production and demo builds, Node 20/22 Linux CI, Windows CI, a Chromium browser export smoke, Dependabot, and versioned Windows release builds with SHA-256 checksums. The bundled `cloudflared` release helper is pinned and checksum-verified. Core placement, perspective, naming, mockup, persistence, cache, PSB parsing, asset isolation, and export behavior has automated coverage.

- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Releasing](docs/RELEASING.md)
- [Recommended repository rules](docs/REPOSITORY_SETTINGS.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Releases](https://github.com/SLP-DEV1/OpenMockup-Studio/releases)

## Contributing

Bug reports, feature ideas, documentation improvements, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and run this before opening a PR:

```bash
npm ci
npm run check
npm run build:demo
```

## License

Released under the [MIT License](LICENSE).
