# Contributing to OpenMockup Studio

Thanks for helping improve OpenMockup Studio. Contributions can be code, tests, documentation, bug reports, UX feedback, or reproducible PSD compatibility reports.

## Before you start

For a bug, search existing issues first and include the smallest reproducible case you can share. For a larger feature, open a feature request before investing in a large implementation so scope and UX can be discussed first.

Do not attach or commit private customer artwork, licensed mockup packs, credentials, tunnel URLs, or other assets you do not have permission to redistribute.

## Development setup

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer
- `cloudflared` only when testing PSD mode through the public tunnel

```bash
git clone https://github.com/SLP-DEV1/OpenMockup-Studio.git
cd OpenMockup-Studio
npm ci
npm run dev
```

For PSD mode:

```bash
npm run dev:public
```

## Before opening a pull request

Run the same quality gate used by CI:

```bash
npm run check
```

A focused PR is easier to review than a broad refactor. Please keep unrelated formatting changes out of bug fixes and explain any user-visible behavior change in the PR description.

## Useful areas to contribute

See [the roadmap](docs/ROADMAP.md). Good contributions include:

- component and browser-level tests
- export reliability and cancellation
- accessibility and keyboard navigation
- reusable flat-image masks and perspective transforms
- clearer PSD compatibility diagnostics
- documentation and small reproducible fixtures

## Pull request checklist

- The change has one clear purpose.
- New behavior is covered by tests where practical.
- `npm run check` passes locally.
- No private or copyrighted test assets are committed.
- Documentation is updated when behavior or setup changes.

By contributing, you agree that your contribution may be distributed under the repository's MIT License.
