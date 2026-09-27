# PixVerse API Kit Pitch Cleanup Design

**Date:** 2026-09-27
**Status:** Approved for implementation
**Repositories:** `heshaojian/pixverse-api-kit`, `heshaojian/pixverse-pitch-studio`

## Objective

Remove tracked customer-pitch production material from `pixverse-api-kit` now that the same material is preserved and verified in the private `pixverse-pitch-studio` repository. Leave the API kit focused on the Platform and Growth Studio CLI, skills, plugin packaging, API documentation, provider tests, recovery tooling, and security gates.

The cleanup is Git-only. It must not delete, move, rewrite, or otherwise modify any untracked or ignored local job output, customer media, scratch payload, or experiment.

## Source Of Truth

The cleanup uses the destination repository's committed migration records:

- `migration/imported-files.txt`: 442 tracked files copied from API Kit commit `e63e631d001fca713cbc56d6a97544dd67e0e244`.
- `migration/local-media-files.txt`: 70 ignored local media files adopted by Pitch Studio; these are not deletion inputs for this cleanup.
- `migration/sanitized-files.txt`: seven imported files privacy-sanitized in Pitch Studio; the API Kit versions still belong to the removable imported set.

Before removal, the implementation must verify that every imported path exists in the API Kit and that the destination repository remains clean, synchronized with `origin/main`, private, and green in GitHub Actions.

## Removal Boundary

Remove from the API Kit every path listed in Pitch Studio's `migration/imported-files.txt`. This includes:

- `deploy/brand-pitches/`
- `docs/brand-pitches/`
- tracked customer payloads under `payloads/`
- tracked REVOLVE production evidence under `pixverse-cli-jobs/`
- tracked REVOLVE PDP evidence under `pixverse-api-jobs/revolve-pdp/`
- `qa/revolve-v3-v4-comparison/`
- `scripts/sync-vips-pitch-media.mjs`
- pitch-specific tests and fixtures enumerated by the manifest

Also remove the four customer-specific payload-content tests that were intentionally not imported because they directly used the API Kit validator:

- `test/plaud-controlled-payloads.test.js`
- `test/plaud-single-format-reel.test.js`
- `test/plaud-video-lanes.test.js`
- `test/revolve-controlled-payloads.test.js`

Their API-contract value is retained through a new brand-neutral unit test using minimal immutable payloads and `validateCreatePayload`. Customer product claims, URLs, creative direction, manifests, and customer names do not remain in that replacement.

Remove these obsolete package scripts:

- `compare:revolve`
- `test:pitches`
- `test:revolve-pdp-review`
- `test:revolve-pdp-review:coverage`
- `test:vips-pitch:coverage`

Update the API Kit release-script test to assert that pitch-only commands no longer exist while the default API and coverage suites remain hermetic and protected by the no-paid-network guard.

## Retention Boundary

Keep:

- all `src/` implementation
- Platform and Growth Studio skills
- `docs/api/`
- customer-plugin packaging, installer, verifier, and documentation
- generic API, CLI, webhook, recovery, packaging, security, contract, integration, and end-to-end tests
- the repository-split design and implementation plan as provenance
- historical `docs/superpowers/` material; it remains internal history and is already excluded by the customer-plugin allowlist
- all unrelated tracked repository files

The cleanup does not attempt to make the entire Git repository customer-distributable. The packaged customer plugin remains the supported shareable artifact. Git history is not rewritten.

## Local Artifact Preservation

Before editing, record the exact untracked and ignored path inventory outside the repository. After cleanup and tests, compare it with a fresh inventory. Any missing or changed local artifact blocks completion.

No recursive deletion command may target a directory that contains untracked or ignored files. Tracked removals must be driven by the exact committed manifest plus the four named tests.

Known local material to preserve includes `.superpowers/`, `payloads/shoptalk-avatar-2026/`, Platform and PDP job directories, REVOLVE PDP scratch payloads/uploads, `scripts/prepare-revolve-pdp-campaign.mjs`, and `test/revolve-pdp-release.test.js`.

## Documentation

Update the API Kit README and customer-distribution readiness document to state that customer pitch production moved to the private Pitch Studio repository. Do not expose private media, credentials, local paths, or operational job identifiers.

## Verification

The cleanup is complete only when all of the following pass:

1. Every manifest-owned path and the four customer payload tests are absent from the tracked API Kit tree.
2. No pitch-only npm script remains.
3. The neutral Growth Studio payload-boundary unit test passes.
4. `npm run check` passes.
5. `npm run security:scan` passes.
6. `npm audit --audit-level=high` reports no high-severity vulnerability.
7. `npm run test:api` passes with the no-paid-network guard.
8. `npm run test:coverage` passes its 80% thresholds.
9. `npm run test:customer-plugin` passes.
10. Customer plugin packaging and verification pass without pitch content.
11. The untracked and ignored path inventory is unchanged.
12. A code and security review reports no critical or high finding.

## Release Boundary

Implementation creates a scoped local commit on `main`. It does not deploy a page, alter a Cloudflare project, rewrite Git history, delete local untracked artifacts, or push until the user explicitly requests the push.
