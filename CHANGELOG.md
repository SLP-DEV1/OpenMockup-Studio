# Changelog

All notable user-facing changes to OpenMockup Studio should be documented here.

The project follows a lightweight changelog format.

## Unreleased

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
- Added a single npm run check quality gate used locally and in CI.
- Added contribution, security, architecture, roadmap, issue, and pull-request guidance.
- Grouped GitHub Actions dependency updates to reduce maintenance noise.
- Improved page title and social/SEO metadata for hosted deployments.
