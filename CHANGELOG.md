# Changelog

All notable user-facing changes to OpenMockup Studio should be documented here.

The project follows a lightweight changelog format.

## Unreleased

## 0.19.1 - 2026-09-07

### Security and privacy

- Isolated PSD/Photopea design assets from the local Vite application server. `npm run dev:public` now tunnels only a dedicated asset server on a separate localhost port; the OpenMockup UI itself is never exposed through the temporary Cloudflare Tunnel.
- Added a per-run cryptographically random token between the localhost Vite proxy and the isolated asset server. Public access is limited to unpredictable `GET /design/<id>` asset URLs.
- Restricted the isolated asset server to image uploads, bounded upload size, short-lived in-memory assets, and a minimal route surface.

### Reliability and release hardening

- Expanded CI to Node.js 20.19, Node.js 22.19, and Windows Node.js 22.19.
- Added a Chromium browser smoke test covering real file selection, preview rendering, preset download, and batch ZIP export.
- Release branches must now point at the exact current `main` commit before packaging; release tags target the verified commit SHA instead of a mutable branch name.
- Pinned the bundled Windows `cloudflared` binary to an explicit version and SHA-256 checksum instead of downloading `latest` without verification.

### Performance

- Bounded retained batch-preview memory after ZIP creation. Only the first 12 rendered previews keep their Blob/Object URL; additional completed results are released after the archive is generated while export/history counts remain intact.
- Enabled JSZip streaming mode during ZIP generation.

### Maintenance

- Updated `@types/node` to 26.4.0 and `@vitejs/plugin-react` to 6.1.1.

## 0.19.0 - 2026-08-27

### Editing and demo

- Added the zero-install GitHub Pages demo for PNG, JPG, and WebP mockups.
- Added a one-click sample project with original MIT-licensed demo artwork.
- Added true four-corner perspective warping for flat image mockups, with draggable corner handles and matching batch-export geometry.
- Fixed Fill Slot / cover rendering so artwork is clipped to the selected placement area in preview and export.
- Fixed Auto Preview so switching designs cannot leave a previous design visible as the current preview.

### Export reliability

- Made ZIP output collision-safe: duplicate filenames now receive deterministic numeric suffixes instead of silently replacing successful renders.
- Made archive collision handling case-insensitive and kept the export report aligned with final ZIP paths.

### PSD and PSB reliability

- Added a bounded Photopea initialization wait with clear failure handling.
- Made Photopea startup waits terminate cleanly when the client is destroyed.
- Corrected public-development guidance so the local UI and temporary asset endpoint are described accurately.
- Fixed PSB Additional Layer Information parsing to use Adobe's key-specific 4-byte and 8-byte tagged-block length rules.

### Windows distribution

- Added a self-contained Windows x64 release package with a portable runtime and locked dependencies.
- Added one-click launchers for flat-image mode and PSD mode.
- Added the PSD-mode helper binary to the portable package.
- Added SHA-256 checksums for downloadable Windows release ZIPs.

### Repository and contributor experience

- Refreshed the README around the batch-mockup use case and faster onboarding.
- Added a single `npm run check` quality gate used locally and in CI.
- Added contribution, security, architecture, roadmap, issue, and pull-request guidance.
- Grouped GitHub Actions dependency updates to reduce maintenance noise.
- Improved page title and social/SEO metadata for hosted deployments.
