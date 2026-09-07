# Releasing OpenMockup Studio

OpenMockup Studio publishes portable Windows builds from a strict release-branch convention.

## Release checklist

1. Update `package.json` and `package-lock.json` to the intended semantic version.
2. Move user-facing changes from `Unreleased` into a dated changelog section.
3. Run the pull-request CI and require every Linux/Windows check plus the Chromium browser smoke to pass.
4. Merge the release-preparation pull request into `main` only when CI is green.
5. Create `release/vX.Y.Z` from the final current `main` commit. Do not make additional commits on the release branch.
6. The Release workflow verifies all of the following before packaging:
   - branch name matches `package.json`;
   - `HEAD` exactly equals the current remote `main` commit;
   - project checks pass;
   - bundled `cloudflared` matches the pinned version and SHA-256 checksum.
7. The Windows portable ZIP and checksum are built from that verified commit.
8. The GitHub release tag is created against the verified commit SHA, not against a moving branch name.
9. Verify both downloadable assets on the GitHub Release.

The workflow refuses to overwrite an existing release tag or release from a branch that has drifted from `main`.

## Repository rules

The workflow enforces release provenance, but repository-side branch rules are still recommended. The desired settings are documented in [REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md). These are GitHub repository administration settings, not files that CI can enforce by itself.
