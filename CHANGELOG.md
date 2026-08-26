# Changelog

All notable user-facing changes to OpenMockup Studio should be documented here.

The project follows a lightweight changelog format. Until formal releases are published regularly, the `Unreleased` section is the source of truth for upcoming changes.

## Unreleased

### Repository and contributor experience

- Refreshed the README around the batch-mockup use case and faster onboarding.
- Added a single `npm run check` quality gate used locally and in CI.
- Added contribution, security, architecture, roadmap, issue, and pull-request guidance.
- Grouped GitHub Actions dependency updates to reduce maintenance noise.
- Deferred automatic major React and TypeScript upgrades until they can be tested as dedicated migrations.

### Browser demo

- Added a zero-install GitHub Pages deployment for PNG, JPG, and WebP mockups.
- Added a dedicated `demo` build that uses the repository subpath correctly and omits the PSD design-server plugin.
- Disabled PSD selection in the public demo and added an explicit link to the full local version.
- Added the demo build to CI so static hosting regressions are caught before merge.

### Application metadata

- Improved page title and social/SEO metadata for hosted deployments.
