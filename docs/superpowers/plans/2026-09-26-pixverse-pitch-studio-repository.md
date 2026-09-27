# PixVerse Pitch Studio Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and push a private `heshaojian/pixverse-pitch-studio` repository containing the tracked customer pitch pages, payloads, assets, QA tools, and tests currently housed in `pixverse-api-kit`.

**Architecture:** Export only explicitly allowlisted, Git-tracked paths from the committed API-kit snapshot into a new repository. Add a minimal Node.js test/coverage/CI shell around the imported static pitch surfaces, verify security and media-size boundaries, then create and push the private GitHub repository without deleting or deploying anything.

**Tech Stack:** Git, GitHub CLI, Node.js 22+, built-in `node:test`, c8 10.1.3, FFmpeg/FFprobe, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-pixverse-pitch-studio-repository-design.md`

## Global Constraints

- Destination is `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio` and private GitHub repository `heshaojian/pixverse-pitch-studio`.
- Import only files tracked by the committed API-kit snapshot; never copy untracked job outputs or `payloads/shoptalk-avatar-2026/` automatically.
- Include all tracked `payloads/` because the current tracked payloads are Plaud/REVOLVE pitch production inputs.
- Do not import API implementation, credentials, API plugin packaging, or API-only tests.
- Do not remove or rewrite files in `pixverse-api-kit` during this phase.
- Do not deploy or change existing Cloudflare Pages projects or URLs.
- Record source repository, exact source commit, date, and imported paths.
- No file larger than 100 MB may be pushed.
- All tests, coverage gates, security checks, and remote privacy verification must pass before completion.

---

### Task 1: Commit the approved migration plan

**Files:**
- Create: `docs/superpowers/plans/2026-09-26-pixverse-pitch-studio-repository.md`

**Interfaces:**
- Consumes: approved repository design.
- Produces: committed, reviewable execution checklist in the source repository.

- [ ] **Step 1: Validate the plan has no placeholders or contradictions**

```bash
rg -n 'TBD|TODO|FIXME|implement later|fill in' docs/superpowers/plans/2026-09-26-pixverse-pitch-studio-repository.md
git diff --check -- docs/superpowers/plans/2026-09-26-pixverse-pitch-studio-repository.md
```

Expected: no placeholder matches and no whitespace errors.

- [ ] **Step 2: Commit the plan without staging unrelated files**

```bash
git add docs/superpowers/plans/2026-09-26-pixverse-pitch-studio-repository.md
git commit -m "docs: plan pitch studio repository migration"
```

### Task 2: Build a clean tracked-content export

**Files:**
- Create in destination: imported pitch-owned trees
- Create in destination: `MIGRATION.md`
- Create in destination: `migration/imported-files.txt`

**Interfaces:**
- Consumes: source Git commit from `git rev-parse HEAD` and its tracked file index.
- Produces: a clean directory containing only allowlisted files from that exact commit.

- [ ] **Step 1: Refuse an existing non-empty destination**

```bash
test ! -e /Users/john/Projects/Codex/Projects/pixverse-pitch-studio
```

Expected: exit zero. If the path exists, inspect it and stop rather than overwrite it.

- [ ] **Step 2: Record the immutable source identity**

```bash
git rev-parse HEAD
git remote get-url origin
```

Store the returned SHA and URL in the destination `MIGRATION.md`.

- [ ] **Step 3: Generate the allowlisted tracked-file manifest**

Select tracked paths matching:

```text
deploy/brand-pitches/**
docs/brand-pitches/**
qa/**
assets/**
payloads/**
pixverse-cli-jobs/**
pixverse-api-jobs/revolve-pdp/**
test/brand-pitch*.test.js
test/plaud-*.test.js
test/revolve-*.test.js
test/vips-*.test.js
test/unit/revolve-*.test.js
test/unit/vips-*.test.js
test/fixtures/vips-*.json
```

Use `git ls-tree -r --name-only <source-sha>` so the manifest cannot include untracked working-tree files. Sort it and write it to `migration/imported-files.txt`.

- [ ] **Step 4: Export the manifest from Git objects**

Use `git archive <source-sha> <allowlisted paths>` and extract into the new destination. Do not use a recursive filesystem copy from the dirty source checkout.

- [ ] **Step 5: Verify every imported file is accounted for**

Compare the imported file list, excluding new repository-control files, with `migration/imported-files.txt`. Expected: exact match and no `src/`, `.env`, credential store, customer plugin, or untracked Shoptalk path.

### Task 3: Create the focused repository shell

**Files:**
- Create: `README.md`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: imported self-contained pitch pages and tests.
- Produces: `npm test`, `npm run test:coverage`, and `npm run compare:revolve` commands plus a private-repository CI gate.

- [ ] **Step 1: Create `package.json`**

Use this minimal package contract:

```json
{
  "name": "pixverse-pitch-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test test/*.test.js test/unit/*.test.js",
    "test:coverage:vips": "c8 --check-coverage --lines 80 --branches 80 --functions 80 --statements 80 --include 'deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js' --include 'deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js' node --test test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js",
    "test:coverage:revolve": "c8 --check-coverage --lines 80 --branches 80 --functions 80 --statements 80 --include 'deploy/brand-pitches/revolve/pdp-review/data-model.js' --include 'deploy/brand-pitches/revolve/pdp-review/review-store.js' --include 'deploy/brand-pitches/revolve/pdp-review/pair-controller.js' --include 'deploy/brand-pitches/revolve/pdp-review/render.js' node --test test/unit/revolve-pdp-comparison-data-model.test.js test/unit/revolve-pdp-review-store.test.js test/unit/revolve-pdp-pair-controller.test.js test/unit/revolve-pdp-render.test.js",
    "test:coverage": "npm run test:coverage:vips && npm run test:coverage:revolve",
    "compare:revolve": "node ./qa/revolve-v3-v4-comparison/server.js"
  },
  "devDependencies": { "c8": "10.1.3" }
}
```

- [ ] **Step 2: Generate the lock file without running lifecycle scripts**

```bash
npm install --package-lock-only --ignore-scripts
```

Expected: a lockfile tied only to the declared development dependency tree.

- [ ] **Step 3: Create repository guidance**

`README.md` must explain the private/internal purpose, directory layout, testing commands, deployment non-action, customer-data rules, and dependency on the external `pixverse-api` CLI for new generation work.

`MIGRATION.md` must state that pre-split history remains in the API kit and that this repository starts from a clean, provenance-recorded snapshot.

- [ ] **Step 4: Create `.gitignore`**

Ignore at minimum:

```gitignore
node_modules/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
```

- [ ] **Step 5: Create CI**

`.github/workflows/ci.yml` must use `actions/checkout@v4`, `actions/setup-node@v4` with Node 22 and npm cache, install FFmpeg on Ubuntu, run `npm ci --ignore-scripts`, `npm test`, and `npm run test:coverage`.

### Task 4: Validate content, tests, and security

**Files:**
- Test: every imported pitch test
- Inspect: every tracked file in the new repository

**Interfaces:**
- Consumes: completed local repository content.
- Produces: evidence that the repository is self-contained, safe to push privately, and below GitHub limits.

- [ ] **Step 1: Install locked dependencies**

```bash
npm ci --ignore-scripts
```

- [ ] **Step 2: Run the full pitch test suite**

```bash
npm test
```

Expected: every imported Plaud, REVOLVE, VIPS, playbook, review, server, and release test passes.

- [ ] **Step 3: Run both 80% coverage gates**

```bash
npm run test:coverage
```

Expected: both VIPS and REVOLVE executable-module gates pass at 80% or greater for statements, branches, functions, and lines.

- [ ] **Step 4: Scan for sensitive content**

Search tracked text for API keys, bearer tokens, cookies, authorization headers with values, secret/private-key blocks, signed query parameters, and absolute `/Users/` paths. Review every match; secrets or private machine paths are blockers.

- [ ] **Step 5: Enforce GitHub file-size limits**

List every tracked file size and fail if any exceeds 100,000,000 bytes. Record the largest file and total repository working-tree size in the migration report.

- [ ] **Step 6: Verify the import boundary**

Confirm there is no `src/`, `packaging/customer-plugin/`, API skill folder, API key file, untracked Shoptalk payload, or unrelated job directory.

### Task 5: Initialize, create the private remote, and push

**Files:**
- Create: destination `.git/`
- Create remotely: `heshaojian/pixverse-pitch-studio`

**Interfaces:**
- Consumes: verified destination tree.
- Produces: private GitHub repository with `main` tracking `origin/main`.

- [ ] **Step 1: Initialize and inspect the first commit**

```bash
git init -b main
git add --all
git diff --cached --check
git status --short
git commit -m "feat: initialize pixverse pitch studio"
```

Expected: only the allowlisted import and new repository-control files are committed.

- [ ] **Step 2: Create the private GitHub repository and push**

```bash
gh repo create heshaojian/pixverse-pitch-studio --private --source=. --remote=origin --push
```

- [ ] **Step 3: Verify remote state**

```bash
gh repo view heshaojian/pixverse-pitch-studio --json nameWithOwner,visibility,defaultBranchRef,url
git status --short
git rev-list --left-right --count origin/main...HEAD
```

Expected: visibility `PRIVATE`, default branch `main`, clean tracked state, and `0 0` divergence.

- [ ] **Step 4: Verify GitHub Actions registration**

```bash
gh run list --repo heshaojian/pixverse-pitch-studio --limit 5
```

If the first workflow is queued or running, report that state rather than repeatedly polling. If it fails immediately, inspect the failed job once and correct an in-scope repository issue before pushing a fix.

### Task 6: Confirm source preservation and handoff

**Files:**
- Verify only: `/Users/john/Projects/Codex/Projects/pixverse-api-kit`

**Interfaces:**
- Consumes: successful new-repository push.
- Produces: explicit confirmation that source pitch files and deployments remain untouched.

- [ ] **Step 1: Confirm no source deletion occurred**

Verify the API kit still contains `deploy/brand-pitches/`, `docs/brand-pitches/`, and tracked `payloads/` at the source commit.

- [ ] **Step 2: Confirm no deployment mutation occurred**

Do not invoke Wrangler, Cloudflare Pages, or any deployment command. Report that existing URLs were not changed.

- [ ] **Step 3: Report the next reversible step**

Provide the new repository URL, privacy state, source SHA, test totals, coverage results, largest file, and CI state. State that API-kit cleanup is intentionally pending and requires a separate removal change after the user accepts the new repository.
