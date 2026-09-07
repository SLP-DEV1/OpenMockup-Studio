# Recommended GitHub repository rules

These settings live in GitHub repository administration and cannot be represented only by files committed to the repository.

## `main`

Create a branch ruleset targeting `main` with:

- require changes through a pull request;
- require the CI workflow before merge;
- block force pushes;
- block branch deletion;
- require the branch to be up to date before merge if multiple contributors are active.

The required CI jobs should include the Linux Node 20/22 checks, Windows Node 22 check, and browser export smoke.

## `release/v*`

Release branches are intentionally short-lived. Restrict creation and updates to maintainers if the repository plan supports it. The release workflow independently refuses to publish unless the release branch points at the exact current `main` commit.

## Merge policy

Squash merge is recommended for feature and dependency pull requests so each reviewed change lands as one main-branch commit. Delete merged feature/release branches after the release completes.
