# OpenMockup Studio Roadmap

The roadmap is ordered by expected user value and by the technical foundation each item needs. It is directional rather than a promise of release dates.

## Foundation

- [x] Reproducible installs, strict type checks, automated tests, and CI
- [x] Extract testable mockup, persistence, and preview-cache modules from `App.tsx`
- [ ] Add component-level tests for file selection, presets, and batch cancellation
- [ ] Add browser-based export smoke tests with small generated fixtures

## Editing and realism

- [ ] Four-point perspective transforms for flat image mockups
- [ ] Reusable masks for PNG, JPG, and WebP mockups
- [ ] Shadow, highlight, and blend-mode controls
- [ ] Drag-and-drop design ordering and per-product placement defaults

## Reliability and performance

- [ ] Faster batch previews with controlled parallel image rendering
- [ ] Better PSD timeout recovery and resumable batch exports
- [ ] Export manifest import for retrying only failed combinations
- [ ] Performance budgets for large batches and high-resolution files

## Hosting and distribution

- [ ] Authenticated self-hosted asset service with rate limits
- [ ] Static image-mode demo deployment
- [ ] Versioned releases and downloadable Windows packages
- [ ] Optional shared presets for hosted deployments

## Want to help?

Small, testable contributions are especially useful. See [CONTRIBUTING.md](../CONTRIBUTING.md) before starting a larger change.
