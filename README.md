# OpenMockup Studio

> **Open-source batch mockup generator for product sellers and creators.** Combine many designs with many mockups, adjust placement visually, and export every result as a ZIP.

[![CI](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/SLP-DEV1/OpenMockup-Studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Made with React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)](https://react.dev/)

**Free · local-first · no account · no subscription**

![OpenMockup Studio interface](docs/screenshot.png)

OpenMockup Studio is built for Etsy, WooCommerce, marketplace sellers, artists, print shops, and anyone tired of producing product mockups one by one. Load mockups, add designs, fine-tune placement, preview the result, then generate the full batch.

> If OpenMockup Studio saves you manual mockup work, a ⭐ on GitHub helps more creators find it.

## Why use it?

- **Batch-first:** create every mockup/design combination in one run.
- **PSD Smart Object support:** automate compatible PSD templates through Photopea.
- **Flat image support:** use PNG, JPG, and WebP mockups directly in the browser.
- **Visual placement editor:** move, scale, rotate, anchor, fit, and adjust opacity.
- **Marketplace-ready exports:** crop, resize, watermark, rename, convert, and ZIP results.
- **Local-first workflow:** flat-image rendering stays in your browser.
- **Self-hostable:** no account or hosted service is required.

## Quick start

### Windows: easiest route

1. [Download the repository as a ZIP](https://github.com/SLP-DEV1/OpenMockup-Studio/archive/refs/heads/main.zip) and extract it.
2. Install [Node.js 20.19+](https://nodejs.org/).
3. Double-click the launcher you need:

| Launcher | Use it for |
| --- | --- |
| `start-local.bat` | PNG, JPG, and WebP mockups; fully local app server |
| `start.bat` | PSD mode with Photopea and a temporary HTTPS asset tunnel |
| `stop.bat` | Stop the local server and tunnel |

The app opens at `http://127.0.0.1:5173`. Keep the launcher window open while you work.

### Developers

```bash
git clone https://github.com/SLP-DEV1/OpenMockup-Studio.git
cd OpenMockup-Studio
npm ci
npm run dev
```

For PSD support with a temporary Cloudflare Tunnel, install `cloudflared` and run:

```bash
npm run dev:public
```

## Typical workflow

1. Add one or more PSD, PNG, JPG, or WebP mockups.
2. Add your PNG, JPG, or WebP designs.
3. Select a mockup and a design.
4. Adjust placement, scale, rotation, fit, and opacity.
5. Preview the result.
6. Export all combinations as a ZIP.

## Rendering modes

| Capability | Flat image mode | PSD mode |
| --- | ---: | ---: |
| PNG/JPG/WebP mockups | Yes | — |
| PSD Smart Objects | — | Yes |
| Rendering | Browser Canvas | Photopea iframe |
| Public asset URL needed | No | Yes |
| Batch ZIP export | Yes | Yes |
| Account required | No | No |

### Privacy note

Flat image rendering stays in the browser. PSD mode is different: Photopea must be able to download the selected design from a public HTTPS address. `start.bat` / `npm run dev:public` creates a temporary Cloudflare Tunnel for that asset flow.

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
| `npm run check` | Run strict typecheck, tests, and production build |
| `npm run preview` | Preview the production build |
| `npm run clean` | Remove dependencies, builds, and local caches |

## Hosting

Flat image mode can be hosted as a static Vite build. PSD mode additionally needs the temporary-design endpoint used by the Photopea bridge.

For a server deployment:

```bash
npm ci
npm run build
npm run preview
```

Example environment variables are documented in [`.env.example`](.env.example). Public uploads are disabled by default; only enable them behind authentication, a private network, or equivalent access controls.

## Troubleshooting PSD mode

**Photopea cannot fetch the design:** use `start.bat` or `npm run dev:public`; localhost-only asset URLs are not reachable by Photopea.

**A `trycloudflare.com` address expired:** open the app at `http://127.0.0.1:5173`, run `stop.bat`, then start PSD mode again to create a new temporary tunnel.

**A Smart Object is not detected:** verify that the PSD really contains a Smart Object, unlock unusual nested layers where possible, and simplify highly unusual PSD structures before retrying.

PSD batches run serially to keep the Photopea session stable.

## Project health

The repository uses strict TypeScript checks, Vitest, production builds in GitHub Actions, and Dependabot. Core placement, naming, mockup, persistence, cache, and export behavior has automated coverage.

- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Contributing

Bug reports, feature ideas, documentation improvements, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and run this before opening a PR:

```bash
npm ci
npm run check
```

## License

Released under the [MIT License](LICENSE).
