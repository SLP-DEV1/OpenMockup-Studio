# OpenMockup Studio

> **Open-source batch mockup generator for product sellers and creators.** Combine many designs with many mockups, adjust placement visually, and export every result as a ZIP.

[![CI](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml)
[![Demo](https://img.shields.io/badge/Try%20the%20demo-GitHub%20Pages-222222?logo=github)](https://slp-dev1.github.io/OpenMockup-Studio/)
[![Windows Release](https://img.shields.io/badge/Windows-Portable%20Download-0078D4?logo=windows)](https://github.com/SLP-DEV1/OpenMockup-Studio/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)](https://react.dev/)

**Free · local-first · no account · no subscription**

### [▶ Try OpenMockup Studio in your browser](https://slp-dev1.github.io/OpenMockup-Studio/)

The public demo needs no installation and supports PNG, JPG, and WebP mockups. Click **Try sample project** to see it working immediately. Files stay in the browser. PSD Smart Objects require the local version because that workflow uses Photopea and a temporary asset endpoint.

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
| `start-openmockup-psd.bat` | PSD mode with Photopea and the bundled temporary asset tunnel helper |
| `stop.bat` | Stop a remaining local server/tunnel process |

The portable package includes its own runtime, dependencies, and PSD-mode tunnel helper. **You do not need to install Node.js, npm, or cloudflared.** The app opens at `http://127.0.0.1:5173`; keep the launcher window open while you work.

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
| Public asset URL needed | No | Yes |
| Batch ZIP export | Yes | Yes |
| Account required | No | No |
| Public demo | Yes | No |

### Privacy note

Flat image rendering stays in the browser. That includes the public GitHub Pages demo: there is no upload backend in the static demo build.

PSD mode is different: Photopea must be able to download the selected design from a public HTTPS address. `start-openmockup-psd.bat`, `start.bat`, or `npm run dev:public` creates a temporary Cloudflare Tunnel for that asset flow. The OpenMockup UI itself remains on localhost.

Do not use PSD mode for confidential assets unless you understand and accept this data flow. OpenMockup Studio is not affiliated with Photopea.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development mode |
| `npm start` | Start on `127.0.0.1:5173` |
| `npm run dev:public` | Start with a temporary Cloudflare Tunnel |
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

PSD mode additionally needs the temporary-design endpoint used by the Photopea bridge.

For a server deployment:

```bash
npm ci
npm run build
npm run preview
```

Example environment variables are documented in [`.env.example`](.env.example). Public uploads are disabled by default; only enable them behind authentication, a private network, or equivalent access controls.

## Troubleshooting PSD mode

**Photopea cannot fetch the design:** use `start-openmockup-psd.bat`, `start.bat`, or `npm run dev:public`; localhost-only asset URLs are not reachable by Photopea.

**A `trycloudflare.com` address expired:** open the app at `http://127.0.0.1:5173`, stop the previous process, then start PSD mode again to create a new temporary tunnel.

**A Smart Object is not detected:** verify that the PSD/PSB really contains a Smart Object, unlock unusual nested layers where possible, and simplify highly unusual document structures before retrying.

PSD batches run serially to keep the Photopea session stable.

## Project health

The repository uses strict TypeScript checks, Vitest, production and demo builds in GitHub Actions, Dependabot, and versioned Windows release builds with SHA-256 checksums. Core placement, perspective, naming, mockup, persistence, cache, PSB parsing, and export behavior has automated coverage.

- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
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
