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
| `src/lib/app/` | App-level mockup, persistence, sample-project, and preview-cache logic |
| `src/lib/config/` | Product and export profiles |
| `src/lib/export/` | Conversion, naming, ZIP, memory cleanup, and download helpers |
| `src/lib/photopea/` | Photopea bridge and generated rendering scripts |
| `src/lib/` | Image rendering, placement, PSD detection, shared helpers |
| `scripts/design-asset-server.mjs` | Minimal temporary asset server used only by PSD mode |
| `scripts/dev-public.mjs` | Local PSD launcher and Cloudflare Tunnel orchestration |

## Flat-image mode

Flat PNG, JPG, and WebP mockups are rendered with browser APIs. This is the simplest hosting mode and does not need a public asset URL. The GitHub Pages demo uses this path only.

## PSD mode

Photopea runs in an iframe and must be able to fetch the selected transformed design over public HTTPS. The local PSD workflow deliberately separates that public asset path from the application server:

```text
Browser on 127.0.0.1:5173
        |
        | POST /__openmockup/design
        v
Local Vite proxy
        |
        | X-OpenMockup-Token (server-to-server only)
        v
Isolated asset server on 127.0.0.1:5174
        |
        | Cloudflare Tunnel targets this port only
        v
https://<temporary>.trycloudflare.com/design/<random-id>
        |
        v
      Photopea
```

The secret token never needs to be exposed to Photopea or to the browser. Public requests can only fetch an unpredictable temporary design asset. The Vite application port is not routed through the tunnel.

The isolated server keeps designs in memory, enforces a size limit and TTL, rejects non-image uploads, and exposes no application UI or general-purpose file route.

This boundary is security-sensitive. Changes to tunnel behavior, public uploads, message handling, or the Photopea bridge should be reviewed carefully and tested with untrusted filenames and malformed input.

## Batch memory model

Rendering must stay bounded after a large batch. Results are needed in memory until JSZip has generated the download. After archive creation, OpenMockup keeps only a small preview subset and releases Object URLs and Blob references for the remaining results. Do not reintroduce an unbounded rendered-image gallery.

## Quality gate

```bash
npm run check
```

This runs strict TypeScript checks, the Vitest suite, and a production build. CI additionally checks the static demo on Linux Node 20/22 and Windows Node 22, then runs a real Chromium export smoke test.

## Design principles

- Keep browser-only flat rendering independent from PSD/tunnel requirements.
- Never expose the Vite UI through the temporary PSD asset tunnel.
- Keep public routes minimal, temporary, unguessable, and read-only where possible.
- Prefer pure, testable helpers outside large React components.
- Revoke temporary browser resources and keep batch state bounded.
- Fail clearly when a PSD or Smart Object layout is unsupported.
- Treat public-upload and tunnel code as an explicit trust boundary.
