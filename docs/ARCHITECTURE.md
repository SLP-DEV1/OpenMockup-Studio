# Architecture

OpenMockup Studio is a React + TypeScript + Vite application with two rendering paths: browser Canvas for flat-image mockups and a Photopea bridge for PSD Smart Objects.

## High-level flow

```text
Mockup files + design files
          |
          v
      React UI
          |
          +-----------------------+
          |                       |
          v                       v
 Flat image renderer        Photopea bridge
   Browser Canvas          iframe + PSD scripts
          |                       |
          +-----------+-----------+
                      v
               Export pipeline
          resize / crop / rename
                ZIP download
```

## Main areas

| Path | Responsibility |
| --- | --- |
| `src/components/` | Focused React interface components |
| `src/lib/app/` | App-level mockup, persistence, and preview-cache logic |
| `src/lib/config/` | Product and export profiles |
| `src/lib/export/` | Conversion, naming, ZIP, and download helpers |
| `src/lib/photopea/` | Photopea bridge and generated rendering scripts |
| `src/lib/` | Image rendering, placement, PSD detection, shared helpers |
| `scripts/` | Local launcher, tunnel, and cleanup helpers |

## Flat-image mode

Flat PNG, JPG, and WebP mockups are rendered with browser APIs. This is the simplest hosting mode and does not need a public asset URL.

## PSD mode

PSD rendering runs through Photopea in an iframe. The selected design must be retrievable by Photopea, so local PSD mode can start a temporary Cloudflare Tunnel and exposes only the temporary design endpoint needed by that workflow.

This boundary is security-sensitive. Changes to tunnel behavior, public uploads, message handling, or the Photopea bridge should be reviewed carefully and tested with untrusted filenames and malformed input.

## Quality gate

```bash
npm run check
```

This runs strict TypeScript checks, the Vitest suite, and a production build. GitHub Actions executes the same command for pushes and pull requests.

## Design principles

- Keep browser-only flat rendering independent from PSD/tunnel requirements.
- Prefer pure, testable helpers outside large React components.
- Revoke temporary browser resources and keep batch state bounded.
- Fail clearly when a PSD or Smart Object layout is unsupported.
- Treat public-upload and tunnel code as an explicit trust boundary.
