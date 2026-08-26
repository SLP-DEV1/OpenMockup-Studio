# Releasing OpenMockup Studio

OpenMockup Studio publishes portable Windows builds from a protected release branch convention.

## Release checklist

1. Update `package.json` to the intended semantic version.
2. Move user-facing changes from `Unreleased` into a dated changelog section.
3. Run `npm ci` and `npm run check` through the pull-request CI.
4. Merge the release-preparation pull request into `main` only when CI is green.
5. Create a branch named `release/vX.Y.Z` from the final `main` commit.
6. The Release workflow verifies that the branch name matches `package.json`, runs the full checks again, builds the portable Windows x64 ZIP, creates its SHA-256 checksum, and publishes tag `vX.Y.Z` against `main`.
7. Verify both downloadable assets on the GitHub Release before closing the release issue.

The workflow refuses to overwrite an existing release tag.
