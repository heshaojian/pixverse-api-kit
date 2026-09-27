# PixVerse API Kit Pitch Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated tracked customer-pitch production material from `pixverse-api-kit` while preserving API behavior, customer-plugin packaging, provenance, and every untracked or ignored local artifact.

**Architecture:** Treat the committed Pitch Studio migration manifest as the exact tracked-removal allowlist. Replace four customer-specific payload-content tests with one brand-neutral validator contract, remove pitch-only npm commands, update repository-boundary documentation, and verify the API-only and plugin release surfaces without rewriting history or deploying anything.

**Tech Stack:** Node.js 20+, ES modules, built-in `node:test`, npm, c8, Git, GitHub CLI

**Spec:** `docs/superpowers/specs/2026-09-27-pixverse-api-kit-pitch-cleanup-design.md`

## Global Constraints

- Work in `/Users/john/Projects/Codex/Projects/pixverse-api-kit` on `main`.
- Use `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt` as the exact 442-file tracked-removal allowlist.
- Preserve every untracked and ignored file in place; never use `git clean`, recursive deletion, reset, checkout, or history rewriting.
- Do not change Cloudflare Pages, credentials, provider configuration, or live PixVerse resources.
- Keep the split design and migration plan in API Kit as provenance.
- Keep historical `docs/superpowers/` content; the customer-plugin build already excludes it.
- Maintain the no-paid-network guard for all API and plugin tests.
- Do not push. Produce a verified local commit and wait for an explicit push request.

---

### Task 1: Lock The Preservation And Destination Preconditions

**Files:**
- Read: `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt`
- Read: `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/local-media-files.txt`
- Read: `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/sanitized-files.txt`
- Read: `docs/superpowers/specs/2026-09-27-pixverse-api-kit-pitch-cleanup-design.md`

**Interfaces:**
- Consumes: clean and synchronized Pitch Studio `main`, its three migration manifests, and the current API Kit working tree.
- Produces: captured pre-cleanup inventories and verified cleanup preconditions; no repository mutation.

- [ ] **Step 1: Verify Pitch Studio is the synchronized private source of truth**

Run:

```bash
git -C /Users/john/Projects/Codex/Projects/pixverse-pitch-studio status --short --branch
test "$(git -C /Users/john/Projects/Codex/Projects/pixverse-pitch-studio rev-parse HEAD)" = \
  "$(git -C /Users/john/Projects/Codex/Projects/pixverse-pitch-studio ls-remote origin refs/heads/main | awk '{print $1}')"
gh repo view heshaojian/pixverse-pitch-studio \
  --json isPrivate,defaultBranchRef \
  --jq '.isPrivate == true and .defaultBranchRef.name == "main"'
gh run list --repo heshaojian/pixverse-pitch-studio --limit 1 \
  --json status,conclusion,headSha
```

Expected: the working tree is clean, local and remote SHAs match, the repository is private on `main`, and the latest Pitch Studio CI run completed successfully for that SHA.

- [ ] **Step 2: Verify the 442-file removal manifest is complete and currently present**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const manifest = "/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt";
const files = fs.readFileSync(manifest, "utf8").trim().split("\n");
const missing = files.filter((file) => !fs.existsSync(file));
const forbidden = files.filter((file) => file.startsWith("src/") || file.startsWith("packaging/") || file.startsWith(".agents/"));
console.log(JSON.stringify({ count: files.length, missing, forbidden }, null, 2));
if (files.length !== 442 || missing.length || forbidden.length) process.exit(1);
NODE
```

Expected: `count` is `442`; both arrays are empty.

- [ ] **Step 3: Capture the untracked and ignored preservation inventory in the execution record**

Run:

```bash
git status --short --untracked-files=all
git ls-files --others --ignored --exclude-standard -- \
  assets/revolve-pilot-controlled-images \
  deploy/brand-pitches/revolve/v4/assets/posters \
  payloads/shoptalk-avatar-2026 \
  pixverse-api-jobs \
  scripts/prepare-revolve-pdp-campaign.mjs \
  test/revolve-pdp-release.test.js | LC_ALL=C sort
find \
  assets/revolve-pilot-controlled-images \
  deploy/brand-pitches/revolve/v4/assets/posters \
  payloads/shoptalk-avatar-2026 \
  pixverse-api-jobs \
  -type f -exec stat -f '%N|%z|%m' {} + 2>/dev/null | LC_ALL=C sort
```

Expected: retain the exact command output for comparison in Task 5. This step does not write to the repository.

---

### Task 2: Replace Customer Payload Tests With A Neutral API Contract

**Files:**
- Create: `test/unit/growth-studio-payload-boundary.test.js`
- Delete: `test/plaud-controlled-payloads.test.js`
- Delete: `test/plaud-single-format-reel.test.js`
- Delete: `test/plaud-video-lanes.test.js`
- Delete: `test/revolve-controlled-payloads.test.js`

**Interfaces:**
- Consumes: `validateCreatePayload(payload: object): void` from `src/client.js`.
- Produces: brand-neutral coverage for source-URL, uploaded-image, numeric-string folder ID, and immutability boundaries.

- [ ] **Step 1: Add the neutral validator test**

Create `test/unit/growth-studio-payload-boundary.test.js` with:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { validateCreatePayload } from "../../src/client.js";

const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
};

test("Growth Studio accepts a neutral product URL payload without mutation", () => {
  const payload = freeze({
    folder_id: "630251570268735431",
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  });

  assert.doesNotThrow(() => validateCreatePayload(payload));
  assert.deepEqual(payload, {
    folder_id: "630251570268735431",
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  });
});

test("Growth Studio accepts only PixVerse upload URLs for image payloads", () => {
  assert.doesNotThrow(() => validateCreatePayload(freeze({
    product: {
      images: [{ url: "https://media.pixverse.ai/marketing_hub_website/openapi_video_inputs/uploads/example/product.webp" }],
    },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  })));

  assert.throws(() => validateCreatePayload({
    product: { images: [{ url: "https://shop.example.com/product.webp" }] },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  }), /Product images must use URLs returned by the image upload endpoint/);
});

test("Growth Studio rejects unsafe numeric folder IDs before network access", () => {
  assert.throws(() => validateCreatePayload({
    folder_id: 630251570268735431,
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  }), /folder_id must be a numeric string/);
});
```

- [ ] **Step 2: Run the neutral contract test**

Run:

```bash
node --import ./scripts/no-paid-network.js --test test/unit/growth-studio-payload-boundary.test.js
```

Expected: three tests pass with zero network access.

- [ ] **Step 3: Remove the four customer-specific tests**

Use `apply_patch` to delete exactly:

```text
test/plaud-controlled-payloads.test.js
test/plaud-single-format-reel.test.js
test/plaud-video-lanes.test.js
test/revolve-controlled-payloads.test.js
```

- [ ] **Step 4: Run the API suite to prove coverage is retained**

Run:

```bash
npm run test:api
```

Expected: all API tests pass and the new neutral unit test is included through `test/unit/*.test.js`.

- [ ] **Step 5: Commit the neutral contract transition**

```bash
git add test/unit/growth-studio-payload-boundary.test.js \
  test/plaud-controlled-payloads.test.js \
  test/plaud-single-format-reel.test.js \
  test/plaud-video-lanes.test.js \
  test/revolve-controlled-payloads.test.js
git commit -m "test: replace customer payload fixtures"
```

---

### Task 3: Remove The Manifest-Owned Pitch Surface

**Files:**
- Delete: every path in `/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt`
- Modify: `package.json`
- Modify: `test/unit/release-scripts.test.js`

**Interfaces:**
- Consumes: exact 442-line Pitch Studio import manifest and existing npm script contract.
- Produces: API-only tracked tree and package script surface.

- [ ] **Step 1: Add the failing release-boundary assertions**

Replace the test named `default tests are hermetic and pitch asset tests are opt-in` in `test/unit/release-scripts.test.js` with:

```js
test("default tests are hermetic and pitch production lives outside API Kit", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const rootApiTests = [
    "test/client.test.js",
    "test/folders.test.js",
    "test/jobs.test.js",
    "test/platform-skill.test.js",
  ];
  const removedScripts = [
    "compare:revolve",
    "test:pitches",
    "test:revolve-pdp-review",
    "test:revolve-pdp-review:coverage",
    "test:vips-pitch:coverage",
  ];
  const removedPaths = [
    "deploy/brand-pitches",
    "docs/brand-pitches",
    "payloads",
    "pixverse-cli-jobs",
    "qa/revolve-v3-v4-comparison",
  ];

  assert.equal(packageJson.scripts.test, "npm run test:api");
  assert.match(packageJson.scripts["test:api"], /--import \.\/scripts\/no-paid-network\.js/);
  for (const file of rootApiTests) {
    assert.match(packageJson.scripts["test:api"], new RegExp(file.replaceAll(".", "\\.")));
    assert.match(packageJson.scripts["test:coverage"], new RegExp(file.replaceAll(".", "\\.")));
  }
  for (const script of removedScripts) assert.equal(packageJson.scripts[script], undefined, script);
  const { stdout: trackedPitchFiles } = await execFileAsync("git", ["ls-files", "--", ...removedPaths], {
    cwd: process.cwd(),
  });
  assert.equal(trackedPitchFiles.trim(), "");
});
```

- [ ] **Step 2: Run the boundary test and verify the RED state**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  --test-name-pattern="pitch production lives outside API Kit" \
  test/unit/release-scripts.test.js
```

Expected: FAIL because pitch scripts and tracked pitch paths still exist.

- [ ] **Step 3: Remove only manifest-listed tracked files**

Run:

```bash
git rm --pathspec-from-file=/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt
```

Expected: Git stages 442 tracked deletions. Ignored posters, customer source images, and untracked job artifacts remain on disk.

- [ ] **Step 4: Remove the five obsolete package scripts**

Use `apply_patch` to delete these keys from `package.json` without changing API or plugin scripts:

```json
"compare:revolve"
"test:pitches"
"test:revolve-pdp-review"
"test:revolve-pdp-review:coverage"
"test:vips-pitch:coverage"
```

- [ ] **Step 5: Run the boundary test and verify the GREEN state**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  --test-name-pattern="pitch production lives outside API Kit" \
  test/unit/release-scripts.test.js
```

Expected: PASS.

- [ ] **Step 6: Verify exact tracked removal and retained API boundaries**

Run:

```bash
node <<'NODE'
const fs = require("node:fs");
const manifest = "/Users/john/Projects/Codex/Projects/pixverse-pitch-studio/migration/imported-files.txt";
const files = fs.readFileSync(manifest, "utf8").trim().split("\n");
const remaining = files.filter((file) => fs.existsSync(file) && !fs.lstatSync(file).isDirectory());
const required = ["src/cli.js", "src/platform/cli.js", "src/growth-studio/cli.js", "scripts/package-customer-plugin.js"];
const missingRequired = required.filter((file) => !fs.existsSync(file));
console.log(JSON.stringify({ remaining, missingRequired }, null, 2));
if (remaining.length || missingRequired.length) process.exit(1);
NODE
```

Expected: both arrays are empty. Directories containing preserved ignored/untracked files may still exist and are not failures.

- [ ] **Step 7: Commit the tracked pitch removal**

```bash
git add package.json test/unit/release-scripts.test.js
git commit -m "refactor: remove pitch production surface"
```

---

### Task 4: Document The New Repository Boundary

**Files:**
- Modify: `README.md`
- Modify: `docs/customer-distribution-readiness.md`

**Interfaces:**
- Consumes: the verified API-only tracked tree from Task 3.
- Produces: current ownership guidance without claiming that old Git history is sanitized.

- [ ] **Step 1: Add the repository boundary to README**

After the opening paragraph in `README.md`, add:

```markdown
## Repository boundary

Customer pitch pages, reviewed customer payloads, pitch-production evidence, and pitch QA now live in the private [`pixverse-pitch-studio`](https://github.com/heshaojian/pixverse-pitch-studio) repository. This API Kit owns only the Platform and Growth Studio CLI, API skills and documentation, durable recovery, security controls, and customer-plugin packaging.

Historical pitch material remains in this repository's Git history. Share the curated customer plugin—not this development repository—unless a separately reviewed distribution repository is approved.
```

- [ ] **Step 2: Update distribution-readiness status and completed boundary work**

Change the header to:

```markdown
**Status:** In progress

**Reviewed:** 2026-09-27
```

Replace the stale paragraph beginning `The API CLI is mixed with customer-specific` with:

```markdown
Customer pitch pages, tracked payloads, production evidence, QA tools, and pitch tests were separated into the private `heshaojian/pixverse-pitch-studio` repository and removed from the current API Kit tree on 2026-09-27. Historical customer and internal material still exists in this repository's Git history, and internal plans remain in the working tree. A customer repository must therefore still start with fresh history rather than as a branch or ordinary clone of this repository.
```

Mark only the current-tree removal item as completed:

```markdown
- [x] Remove tracked customer-specific pitch, payload, job-record, QA, and pitch-test surfaces from the current API Kit tree.
```

Keep the fresh-history repository, legal, support, licensing, examples, and release-governance items unchecked.

- [ ] **Step 3: Verify documentation accuracy and links**

Run:

```bash
rg -n 'pixverse-pitch-studio|Historical pitch material|Status: In progress|\[x\] Remove tracked' \
  README.md docs/customer-distribution-readiness.md
git diff --check -- README.md docs/customer-distribution-readiness.md
```

Expected: every new boundary statement is present and whitespace checks pass.

- [ ] **Step 4: Commit the boundary documentation**

```bash
git add README.md docs/customer-distribution-readiness.md
git commit -m "docs: record pitch studio ownership"
```

---

### Task 5: Verify, Review, And Produce The Local Cleanup Commit Set

**Files:**
- Verify: all tracked files changed by Tasks 2-4
- Preserve: every untracked and ignored path recorded in Task 1

**Interfaces:**
- Consumes: the complete cleanup commit set.
- Produces: verified local `main` ready for an explicit user-approved push.

- [ ] **Step 1: Run syntax, security, dependency, API, coverage, and plugin gates**

Run each command separately:

```bash
npm run check
npm run security:scan
npm audit --audit-level=high
npm run test:api
npm run test:coverage
npm run test:customer-plugin
npm run package:customer-plugin
```

Expected: every command exits zero; no command contacts a production PixVerse endpoint or submits a paid job.

- [ ] **Step 2: Verify the packaged plugin remains pitch-free**

Run:

```bash
node ./scripts/customer-plugin/verify.js \
  dist/customer-plugin/0.3.0-beta.2/stage
```

Expected: verification succeeds and reports no customer-specific or internal-design surface.

- [ ] **Step 3: Re-run and compare the preservation inventory**

Run the three inventory commands from Task 1 Step 3 again.

Expected: every pre-cleanup untracked and ignored path remains with the same file size and modification time. New generated `dist/` output is allowed because it is produced by the verification command and remains ignored.

- [ ] **Step 4: Review the complete commit range**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat e63e631d001fca713cbc56d6a97544dd67e0e244..HEAD
git diff --check e63e631d001fca713cbc56d6a97544dd67e0e244..HEAD
```

Expected: only the approved spec, plan, neutral contract, manifest-owned removals, package script cleanup, release-boundary test, README, and readiness documentation are tracked changes. Existing untracked artifacts remain uncommitted.

- [ ] **Step 5: Dispatch code and security review**

Ask the code reviewer to verify correctness, missing references, and test coverage. Ask the security reviewer to verify secret boundaries, plugin contents, untracked preservation, and destructive-operation safety.

Expected: no unresolved critical or high finding. Apply any required correction with `apply_patch`, rerun the affected gate and the full API suite, then commit the correction with a conventional commit message.

- [ ] **Step 6: Confirm local completion without pushing**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: `main` is ahead only by the approved cleanup commits; the tracked tree is clean; preserved untracked paths remain visible; no push or deployment has occurred.
