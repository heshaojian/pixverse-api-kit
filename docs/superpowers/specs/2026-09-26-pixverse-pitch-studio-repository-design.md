# PixVerse Pitch Studio Repository Design

**Date:** 2026-09-26

**Status:** Approved direction; migration pending

## Objective

Create a private repository named `heshaojian/pixverse-pitch-studio` for customer pitch pages, review experiences, product assets, pitch-specific QA, and deployment material. Keep `pixverse-api-kit` focused on the customer-shareable Platform and Growth Studio CLI, skills, plugin packaging, API documentation, and provider tests.

The migration is deliberately reversible: first create and verify the new repository without deleting or rewriting anything in `pixverse-api-kit`. Source cleanup is a separate follow-up only after the new repository is confirmed healthy.

## Repository Identity

- GitHub owner: `heshaojian`
- Repository: `pixverse-pitch-studio`
- Visibility: private
- Default branch: `main`
- Local checkout: `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio`
- Source snapshot: the current committed `origin/main` of `heshaojian/pixverse-api-kit`

## Ownership Boundary

The new repository owns:

- `deploy/brand-pitches/`
- `docs/brand-pitches/`
- `qa/`
- Customer product images under `assets/`
- Customer generation payloads under `payloads/`
- Tracked pitch-production records under `pixverse-cli-jobs/`
- Tracked REVOLVE PDP review records under `pixverse-api-jobs/revolve-pdp/`
- Pitch-specific top-level tests for Plaud, REVOLVE, VIPS, and the cross-brand playbook
- Pitch-specific unit tests under `test/unit/`
- Pitch test fixtures under `test/fixtures/`

The API kit continues to own:

- `src/`
- `.agents/skills/pixverse-platform-api/`
- `.agents/skills/pixverse-growth-studio-api/`
- `docs/api/`
- `packaging/customer-plugin/`
- API contract, validation, job, recovery, webhook, integration, and security tests
- Generic synthetic API examples

The pitch repository invokes a released or locally installed `pixverse-api` CLI. It must not import implementation modules from the API kit.

## Import Strategy

Create the new repository from a clean committed snapshot, not from the dirty working tree. Import only Git-tracked pitch-owned paths so untracked job outputs, credentials, local caches, and unrelated experiments cannot cross the boundary accidentally.

The initial migration commit records:

- Source repository URL
- Exact source commit SHA
- Imported path manifest
- Migration date

The original API kit history remains the immutable historical source for pre-split changes. The new repository begins with a clean snapshot plus explicit provenance instead of rewriting or force-pushing either repository.

## Repository Runtime

The initial pitch repository uses Node.js 22 or newer and built-in `node:test`. Runtime pages remain static HTML, CSS, JavaScript, JSON, images, and video.

Create a focused `package.json` with:

- `test` for all imported pitch tests
- `test:coverage` for pitch JavaScript coverage gates
- `compare:revolve` for the existing local comparison server

Only dependencies proven necessary by the imported tests are allowed. The current pitch surfaces use Node built-ins; `c8` remains the development coverage dependency. FFmpeg/FFprobe is an external test prerequisite for media verification.

## CI And Security

The private GitHub repository receives a CI workflow that:

1. Checks out the repository.
2. Uses Node.js 22.
3. Installs FFmpeg.
4. Installs locked npm dependencies.
5. Runs the complete pitch test suite.
6. Runs coverage gates at 80% for statements, branches, functions, and lines over executable pitch modules.

Before the first push:

- Scan tracked content for API keys, bearer tokens, cookies, signed URLs, private local paths, and credential files.
- Confirm no imported file exceeds GitHub's 100 MB per-file limit.
- Confirm all customer media and product assets are intended for this private repository.
- Preserve existing `noindex`, privacy, and customer-claim safeguards.

## Deployment Boundary

Existing public Cloudflare Pages project names and URLs must not change during repository creation. No deployment occurs as part of the split. After the new repository is verified, each Pages project can be reconnected or redeployed from the same self-contained pitch folder while retaining its existing project name and public URL.

## Source Repository Safety

This phase does not delete pitch files from `pixverse-api-kit`, rewrite its history, change its CI, or change its Pages deployments. The only source-repository change is this migration specification.

After the new repository passes local and GitHub CI, a separate cleanup change may remove pitch-owned paths and scripts from the API kit. That cleanup must verify the API-only suite and customer plugin still pass before it is pushed.

## Acceptance Criteria

1. `heshaojian/pixverse-pitch-studio` exists as a private GitHub repository with default branch `main`.
2. A local checkout exists at `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio`.
3. Every imported file is listed in the migration manifest and originates from the recorded API-kit commit.
4. The imported pitch pages, assets, playbook, QA tools, payloads, and tests are present.
5. No API implementation, API credential, untracked job artifact, or unrelated experiment is imported.
6. The local pitch test suite and coverage gate pass.
7. GitHub CI is configured and the first push succeeds.
8. The API kit remains unchanged apart from the committed migration specification.
9. Existing deployed pitch URLs remain unchanged and no deployment is triggered.
