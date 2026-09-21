# PixVerse API Plugin macOS Codex Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a sanitized, self-contained PixVerse API Plugin ZIP that installs into Codex on a fresh macOS machine without access to the internal repository.

**Architecture:** Keep the existing CLI and internal skills as the implementation source, but export a separate customer-safe package through a strict allowlist. A Node.js release builder stages the embedded runtime and plugin content, validates it, creates a deterministic ZIP, and emits checksum/report sidecars; isolated tests exercise the generated wrapper and macOS installer without credentials or paid network access.

**Tech Stack:** Node.js 20+ ESM, Node test runner, shell `.command` helpers, Codex plugin/marketplace manifests, `zip`/`unzip`, SHA-256, existing `c8` coverage and no-paid-network guard.

**Spec:** `docs/superpowers/specs/2026-09-21-pixverse-api-private-beta-plugin-design.md`

## Global Constraints

- Product name is **PixVerse API Plugin**; plugin ID is `pixverse-api`; marketplace ID is `pixverse-private-beta`.
- Candidate version is exactly `0.3.0-beta.1` and targets macOS with Node.js 20 or newer.
- The general web-product `pixverse` CLI remains separate from `pixverse-api`.
- Platform and Growth Studio credentials, billing, configuration, and recovery never fall back to each other.
- No credential, `.env`, customer material, live PixVerse identifier, private URL, generated media URL, Git history, or internal absolute path may enter the archive.
- Packaging and verification must not make authenticated or paid PixVerse requests.
- The archive stays local; implementation does not publish, upload, or install it on another machine.
- `dist/customer-plugin/0.3.0-beta.1/` is generated and ignored; source templates live under `packaging/customer-plugin/`.
- Production runtime coverage remains at least 80% for lines, branches, functions, and statements.

## File Map

- `src/growth-studio/pdp.js` — accept and normalize omitted, null, or explicit PDP video configuration.
- `src/cli.js` — expose a credential-free `--version` command.
- `packaging/customer-plugin/` — committed customer-safe skill, documentation, legal-draft, and installer source files.
- `scripts/customer-plugin/config.js` — immutable release metadata, allowlists, denylists, and paths.
- `scripts/customer-plugin/stage.js` — build the self-contained marketplace/plugin tree from approved inputs.
- `scripts/customer-plugin/verify.js` — validate manifests, inventory, content safety, hashes, wrapper behavior, and extracted artifacts.
- `scripts/customer-plugin/archive.js` — normalize timestamps, create the ZIP, calculate sidecar hashes, and write the release report.
- `scripts/package-customer-plugin.js` — orchestration entry point for `npm run package:customer-plugin`.
- `test/unit/customer-plugin-*.test.js` — unit tests for metadata, staging, sanitization, manifests, hashes, and determinism.
- `test/integration/customer-plugin-package.test.js` — builds and exercises the extracted package.
- `test/e2e/customer-plugin-install.e2e.test.js` — installs and removes the plugin using an isolated home and fake Codex executable.
- `package.json`, `.gitignore`, `.github/workflows/ci.yml`, `README.md` — expose and document the release gates.

---

### Task 1: Close Runtime Contract Gaps

**Files:**
- Modify: `src/growth-studio/pdp.js`
- Modify: `src/cli.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/unit/growth-studio-pdp.test.js`
- Modify: `test/integration/cli-routing.test.js`
- Modify: `docs/api/growth-studio-pdp.md`

**Interfaces:**
- Consumes: existing `validatePdpPayload(payload)`, `normalizePdpPayload(payload)`, and `main(argv, context)`.
- Produces: `normalizePdpPayload()` omits wire `video` for absent/null input; package metadata and `main(["--version"])` report `0.3.0-beta.1`.

- [ ] **Step 1: Write failing PDP compatibility tests**

Add exact cases showing that missing and null video values validate, normalize without a `video` property, and do not mutate the caller; retain rejection of non-null non-object values and require `mode` for an explicit object.

```js
test("PDP accepts omitted and null video by omitting it from the wire body", () => {
  for (const input of [
    { product: minimalPayload().product },
    { product: minimalPayload().product, video: null },
  ]) {
    const snapshot = structuredClone(input);
    const normalized = normalizePdpPayload(input);
    assert.equal("video" in normalized, false);
    assert.deepEqual(input, snapshot);
  }
});

test("PDP requires mode only when video is an object", () => {
  assert.throws(
    () => validatePdpPayload({ product: minimalPayload().product, video: {} }),
    /video.mode must be one of: standard, pro/,
  );
  for (const video of [[], "video", 42]) {
    assert.throws(
      () => validatePdpPayload({ product: minimalPayload().product, video }),
      /PDP video must be a plain object/,
    );
  }
});
```

- [ ] **Step 2: Run the PDP tests and confirm the compatibility case fails**

Run: `node --test test/unit/growth-studio-pdp.test.js`

Expected: the omitted/null test fails because the current validator requires `video` and rejects null.

- [ ] **Step 3: Implement conditional video validation and immutable normalization**

Use one explicit branch and conditional object spread:

```js
export function validatePdpPayload(payload) {
  assertPlainObject(payload, "PDP payload");
  assertKnownFields(payload, ROOT_FIELDS, "PDP");
  if (payload.product === undefined) throw new Error("PDP payload requires product.");
  validateProduct(payload.product);
  if (payload.video !== undefined && payload.video !== null) validateVideo(payload.video);
}

export function normalizePdpPayload(payload) {
  validatePdpPayload(payload);
  return {
    type: PDP_WIRE_TYPE,
    product: normalizeProduct(payload.product),
    ...(payload.video === undefined || payload.video === null
      ? {}
      : { video: { ...payload.video } }),
  };
}
```

Extract `normalizeProduct(product)` from the existing inline product mapping so the function remains focused and immutable.

- [ ] **Step 4: Write the failing CLI version test**

```js
test("top-level version is credential-free", async () => {
  const stdout = createCapture();
  const exitCode = await main(["--version"], { stdout, stderr: createCapture() });
  assert.equal(exitCode, 0);
  assert.equal(stdout.text(), "0.3.0-beta.1\n");
});
```

- [ ] **Step 5: Run the routing test and confirm `--version` fails**

Run: `node --test test/integration/cli-routing.test.js`

Expected: FAIL with `Unknown provider or command: --version`.

- [ ] **Step 6: Implement version output without loading either provider**

Set `version` to `0.3.0-beta.1` in both package files, export `CLI_VERSION`, and check version arguments before `routeCommand()`:

```js
export const CLI_VERSION = "0.3.0-beta.1";

if (argv.length === 1 && ["--version", "-v"].includes(argv[0])) {
  stdout.write(`${CLI_VERSION}\n`);
  return 0;
}
```

- [ ] **Step 7: Update the public PDP guide and run focused tests**

Document the three accepted video shapes and the omission rule. Run:

```bash
node --test test/unit/growth-studio-pdp.test.js test/integration/cli-routing.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the runtime contract changes**

```bash
git add src/growth-studio/pdp.js src/cli.js package.json package-lock.json test/unit/growth-studio-pdp.test.js test/integration/cli-routing.test.js docs/api/growth-studio-pdp.md
git commit -m "fix: align PDP contract and CLI version"
```

---

### Task 2: Add the Customer-Safe Plugin Source Tree

**Files:**
- Create: `packaging/customer-plugin/marketplace.json`
- Create: `packaging/customer-plugin/plugin/.codex-plugin/plugin.json`
- Create: `packaging/customer-plugin/plugin/skills/start/SKILL.md`
- Create: `packaging/customer-plugin/plugin/skills/platform/SKILL.md`
- Create: `packaging/customer-plugin/plugin/skills/growth-studio/SKILL.md`
- Create: `packaging/customer-plugin/plugin/README.md`
- Create: `packaging/customer-plugin/INSTALL-MACOS.md`
- Create: `packaging/customer-plugin/plugin/LICENSE`
- Create: `packaging/customer-plugin/plugin/NOTICE`
- Create: `packaging/customer-plugin/plugin/SECURITY.md`
- Create: `packaging/customer-plugin/plugin/SUPPORT.md`
- Create: `packaging/customer-plugin/plugin/examples/pdp-standard-high.json`
- Create: `test/unit/customer-plugin-content.test.js`

**Interfaces:**
- Consumes: plugin ID/version from the approved spec and API facts from `.agents/skills/` plus `docs/api/`.
- Produces: a committed, neutral input tree that `stageCustomerPlugin(options)` copies without semantic rewriting.

- [ ] **Step 1: Write failing content and manifest tests**

The test must parse both JSON files, traverse every text file, and assert the public identities, three skill names, safe wrapper references, and denied content:

```js
assert.equal(marketplace.name, "pixverse-private-beta");
assert.deepEqual(marketplace.plugins[0].source, {
  source: "local",
  path: "./plugins/pixverse-api",
});
assert.equal(plugin.name, "pixverse-api");
assert.equal(plugin.version, "0.3.0-beta.1");
assert.equal(plugin.skills, "./skills/");
assert.deepEqual(skillNames, ["growth-studio", "platform", "start"]);
assert.doesNotMatch(allText, /\/Users\/|docs\/superpowers|brand-pitches|revolve|feishu\.cn/i);
assert.doesNotMatch(allText, /npm run cli|pixverse-api-kit/);
assert.match(allText, /scripts\/pixverse-api/);
```

- [ ] **Step 2: Run the content test and confirm missing files fail**

Run: `node --test test/unit/customer-plugin-content.test.js`

Expected: FAIL with file-not-found for `packaging/customer-plugin/marketplace.json`.

- [ ] **Step 3: Add valid marketplace and plugin manifests**

Use the canonical marketplace entry shape:

```json
{
  "name": "pixverse-private-beta",
  "interface": { "displayName": "PixVerse Private Beta" },
  "plugins": [{
    "name": "pixverse-api",
    "source": { "source": "local", "path": "./plugins/pixverse-api" },
    "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
    "category": "Developer Tools"
  }]
}
```

The plugin manifest must include only validated fields: `name`, `version`, `description`, `author.name`, `license`, `keywords`, `skills`, and the required `interface` metadata. Do not add MCP, app, hook, website, privacy, terms, email, or repository fields.

- [ ] **Step 4: Add the three concise exported skills**

Name their frontmatter `start`, `platform`, and `growth-studio`. Each skill must tell Codex to resolve the installed plugin root from the current `SKILL.md` location and execute `<plugin-root>/scripts/pixverse-api`. Preserve provider isolation, read-only preflights, explicit billable confirmation, single-submit recovery, string identifiers, and the web CLI distinction.

- [ ] **Step 5: Add neutral documentation, legal draft, and example**

Use only `example.com`, `media.pixverse.ai/example/...`, synthetic IDs, and a neutral product. Mark the license header exactly `PixVerse Private Evaluation License — Draft; Not Approved for External Distribution`, state that legal approval is required before sharing, and list `json-bigint@1.0.0` in `NOTICE`.

- [ ] **Step 6: Validate the plugin source and rerun the test**

Run:

```bash
python3 /Users/john/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py packaging/customer-plugin/plugin
node --test test/unit/customer-plugin-content.test.js
```

Expected: both PASS.

- [ ] **Step 7: Commit the plugin content**

```bash
git add packaging/customer-plugin test/unit/customer-plugin-content.test.js
git commit -m "feat: add sanitized Codex plugin content"
```

---

### Task 3: Implement Strict Allowlist Staging

**Files:**
- Create: `scripts/customer-plugin/config.js`
- Create: `scripts/customer-plugin/stage.js`
- Create: `test/unit/customer-plugin-stage.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `CUSTOMER_PLUGIN_RELEASE`, `CUSTOMER_PLUGIN_ALLOWLIST`, `CUSTOMER_PLUGIN_DENIED_PATTERNS`, and `stageCustomerPlugin({ repoRoot, stageRoot, installDependencies }) -> Promise<StageResult>`.
- `StageResult` is `{ packageRoot: string, pluginRoot: string, files: string[] }` with sorted POSIX-relative file paths.

- [ ] **Step 1: Write failing staging tests**

Use a temporary repository fixture containing approved and forbidden files. Assert that staging creates the exact marketplace layout, copies all `src/**/*.js` and selected `docs/api/*.md`, emits a minimal runtime `package.json`, creates the wrapper, and excludes internal directories.

```js
const result = await stageCustomerPlugin({
  repoRoot: fixtureRoot,
  stageRoot,
  installDependencies: false,
});
assert.equal(await exists(path.join(result.pluginRoot, "scripts/pixverse-api")), true);
assert.equal(await exists(path.join(result.pluginRoot, "runtime/src/cli.js")), true);
assert.equal(await exists(path.join(result.packageRoot, "payloads")), false);
assert.deepEqual(result.files, [...result.files].sort());
```

- [ ] **Step 2: Run the staging test and confirm imports fail**

Run: `node --test test/unit/customer-plugin-stage.test.js`

Expected: FAIL because `scripts/customer-plugin/stage.js` does not exist.

- [ ] **Step 3: Define immutable release metadata and deny rules**

Freeze the release object and arrays:

```js
export const CUSTOMER_PLUGIN_RELEASE = Object.freeze({
  pluginName: "pixverse-api",
  marketplaceName: "pixverse-private-beta",
  version: "0.3.0-beta.1",
  archiveBaseName: "pixverse-api-plugin-codex-0.3.0-beta.1",
  sourceDateEpoch: 1_788_739_200,
});
```

The allowlist must enumerate `src/`, the four selected `docs/api` files, `package.json`, `package-lock.json`, and specific `packaging/customer-plugin` files. Denied path segments must include `.git`, `.env`, `assets`, `deploy`, `docs/brand-pitches`, `docs/superpowers`, `jobs`, `payloads`, `pixverse-api-jobs`, `pixverse-cli-jobs`, `projects`, `qa`, `research`, and `test`.

- [ ] **Step 4: Implement staging with new immutable data**

Create directories and copies without mutating caller data. Render runtime `package.json` as:

```js
const runtimePackage = {
  name: "pixverse-api-plugin-runtime",
  version: release.version,
  private: true,
  type: "module",
  engines: { node: ">=20" },
  dependencies: { "json-bigint": "1.0.0" },
};
```

The wrapper must resolve `../runtime/src/cli.js`, reject Node versions below 20, and use `exec "$NODE_BIN" "$CLI_ENTRY" "$@"` without evaluating arguments.

- [ ] **Step 5: Install production dependencies safely**

When `installDependencies` is true, run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` in the staged runtime. Pass a sanitized environment and capture failure output without exposing environment values. Assert the resulting runtime contains `json-bigint` and no `c8`.

- [ ] **Step 6: Ignore only generated release output and rerun tests**

Add `/dist/customer-plugin/` to `.gitignore`. Run:

```bash
node --test test/unit/customer-plugin-stage.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit staging**

```bash
git add .gitignore scripts/customer-plugin/config.js scripts/customer-plugin/stage.js test/unit/customer-plugin-stage.test.js
git commit -m "feat: stage customer plugin from an allowlist"
```

---

### Task 4: Add Artifact Verification and Deterministic Archiving

**Files:**
- Create: `scripts/customer-plugin/verify.js`
- Create: `scripts/customer-plugin/archive.js`
- Create: `test/unit/customer-plugin-verify.test.js`
- Create: `test/unit/customer-plugin-archive.test.js`

**Interfaces:**
- Consumes: `StageResult` and `CUSTOMER_PLUGIN_RELEASE`.
- Produces: `verifyCustomerPlugin({ packageRoot, pluginValidatorPath }) -> Promise<VerificationResult>` and `archiveCustomerPlugin({ packageRoot, outputDir }) -> Promise<ArchiveResult>`.
- `ArchiveResult` is `{ archivePath, checksumPath, reportPath, archiveSha256, files }`.

- [ ] **Step 1: Write failing verifier tests**

Build fixtures that separately contain `.env`, a synthetic Growth Studio key assembled from separate test string fragments, `/Users/...`, `docs/superpowers`, a customer name, a symlink, a missing wrapper execute bit, and an invalid manifest. Assert each fails closed with a relative path and rule name but never echoes secret contents.

```js
await assert.rejects(
  verifyCustomerPlugin({ packageRoot, pluginValidatorPath }),
  /forbidden credential file: .*\.env/,
);
assert.doesNotMatch(capturedError, new RegExp(["mh_", "live_secret_value"].join("")));
```

- [ ] **Step 2: Run verifier tests and confirm the missing module failure**

Run: `node --test test/unit/customer-plugin-verify.test.js`

Expected: FAIL because `verify.js` does not exist.

- [ ] **Step 3: Implement verifier gates**

Walk with `lstat`, reject symlinks and non-regular files, normalize relative paths, enforce the allowed root shape, scan UTF-8 text for secrets/internal paths/customer deny terms, validate JSON, invoke the Codex plugin validator, run `node --check` on runtime JavaScript, and execute wrapper `--version`, `--help`, `platform --help`, and `growth-studio --help` with every `PIXVERSE_*` variable removed.

- [ ] **Step 4: Write failing archive and determinism tests**

Build the same staged fixture twice in separate directories and assert equal archive SHA-256 values. Extract one archive, verify `MANIFEST.sha256`, and confirm the sidecar report matches the ZIP hash.

```js
assert.equal(first.archiveSha256, second.archiveSha256);
assert.equal(report.archive.sha256, first.archiveSha256);
assert.equal(report.release.version, "0.3.0-beta.1");
assert.equal(report.checks.every(({ status }) => status === "passed"), true);
```

- [ ] **Step 5: Run archive tests and confirm the missing module failure**

Run: `node --test test/unit/customer-plugin-archive.test.js`

Expected: FAIL because `archive.js` does not exist.

- [ ] **Step 6: Implement stable manifest, ZIP, and sidecars**

Hash sorted files excluding `MANIFEST.sha256`, write manifest rows as `<sha256>  <relative-path>`, set all staged file/directory mtimes to `sourceDateEpoch`, and call `zip -X -q` with a sorted explicit argument list. Write `<archive>.zip.sha256` as `<sha256>  <archive-name>` and a stable-key-order `release-report.json` outside the ZIP.

- [ ] **Step 7: Extract and verify the exact ZIP**

Use `unzip -q` into a new temporary directory, verify the internal manifest, then rerun `verifyCustomerPlugin()` against the extracted package. Never treat the pre-ZIP staging check as sufficient.

- [ ] **Step 8: Run focused verification tests and commit**

```bash
node --test test/unit/customer-plugin-verify.test.js test/unit/customer-plugin-archive.test.js
git add scripts/customer-plugin/verify.js scripts/customer-plugin/archive.js test/unit/customer-plugin-verify.test.js test/unit/customer-plugin-archive.test.js
git commit -m "feat: verify and archive the Codex plugin"
```

---

### Task 5: Implement Safe macOS Install and Removal

**Files:**
- Create: `packaging/customer-plugin/Install PixVerse API Plugin.command`
- Create: `packaging/customer-plugin/Uninstall PixVerse API Plugin.command`
- Create: `test/e2e/customer-plugin-install.e2e.test.js`
- Modify: `packaging/customer-plugin/INSTALL-MACOS.md`

**Interfaces:**
- Consumes: archive root, `marketplace.json`, and Codex commands `plugin marketplace add`, `plugin add`, `plugin remove`, and `plugin marketplace remove`.
- Produces: versioned installation at `${HOME}/Library/Application Support/PixVerse/API Plugin/0.3.0-beta.1` and an uninstall receipt containing only the installed path and marketplace name.

- [ ] **Step 1: Write the failing installer E2E test**

Create an isolated home and a fake `codex` executable that appends JSON argument arrays to a log. Execute the installer with `HOME`, `PATH`, and `PIXVERSE_*` variables sanitized. Assert exact copied paths and calls:

```js
assert.deepEqual(codexCalls, [
  ["plugin", "marketplace", "add", installRoot, "--json"],
  ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
]);
assert.equal(await exists(path.join(installRoot, "marketplace.json")), true);
assert.equal((await fs.stat(receiptPath)).mode & 0o077, 0);
```

Then execute the uninstaller and assert `plugin remove` precedes `plugin marketplace remove`, only the receipt-owned version directory is deleted, and an unrelated sibling file survives.

- [ ] **Step 2: Run the installer E2E test and confirm missing helpers fail**

Run: `node --import ./scripts/no-paid-network.js --test test/e2e/customer-plugin-install.e2e.test.js`

Expected: FAIL because the `.command` helpers do not exist.

- [ ] **Step 3: Implement the installer with fail-closed preflight**

Use `#!/bin/zsh`, `set -euo pipefail`, quoted variables, `/usr/bin/dirname`, `/usr/bin/ditto`, and `/usr/bin/mktemp -d`. Check macOS, Node major version, Codex presence, sibling `marketplace.json`, SHA-256 manifest, and plugin manifest before creating the destination. Copy into a temporary sibling, then atomically rename into the versioned destination. Never source `.env`, inspect keys, call `eval`, or print environment values.

- [ ] **Step 4: Implement receipt-scoped uninstall**

The receipt is `${HOME}/Library/Application Support/PixVerse/API Plugin/install-receipt.json`, mode `0600`, and records the exact version directory plus marketplace name. The uninstaller must parse it with Node, reject paths outside `${HOME}/Library/Application Support/PixVerse/API Plugin/`, remove the plugin registration first, remove the marketplace second, and delete only the recorded version directory and receipt.

- [ ] **Step 5: Cover reinstall, failure, and cancellation safety**

Extend the E2E test so a failed marketplace registration removes the temporary copy, preserves a prior installed version, and emits a plain-language error. Confirm the installer never reads or rewrites the operator's shell profiles or credential files.

- [ ] **Step 6: Update install documentation, run E2E, and commit**

```bash
node --import ./scripts/no-paid-network.js --test test/e2e/customer-plugin-install.e2e.test.js
git add 'packaging/customer-plugin/Install PixVerse API Plugin.command' 'packaging/customer-plugin/Uninstall PixVerse API Plugin.command' packaging/customer-plugin/INSTALL-MACOS.md test/e2e/customer-plugin-install.e2e.test.js
git commit -m "feat: add macOS Codex plugin installer"
```

---

### Task 6: Wire the End-to-End Packaging Command

**Files:**
- Create: `scripts/package-customer-plugin.js`
- Create: `test/integration/customer-plugin-package.test.js`
- Modify: `package.json`
- Modify: `scripts/check-syntax.js`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `stageCustomerPlugin`, `verifyCustomerPlugin`, and `archiveCustomerPlugin`.
- Produces: `buildCustomerPlugin({ repoRoot, outputRoot, installDependencies }) -> Promise<ArchiveResult>` and the command `npm run package:customer-plugin`.

- [ ] **Step 1: Write the failing package integration test**

Call `buildCustomerPlugin()` with a temporary output root and real dependency installation. Assert the ZIP, checksum, and report exist; extract it; invoke the bundled wrapper; verify no dev dependency or forbidden surface exists; and run one credential-free PDP dry run using the neutral example.

```js
const version = await execFile(wrapper, ["--version"], cleanProcessOptions);
assert.equal(version.stdout, "0.3.0-beta.1\n");
await execFile(wrapper, [
  "growth-studio", "pdp", "create",
  "--payload", examplePath,
  "--dry-run",
], cleanProcessOptions);
assert.equal(await exists(path.join(pluginRoot, "runtime/node_modules/c8")), false);
```

- [ ] **Step 2: Run the integration test and confirm the orchestrator is missing**

Run: `node --import ./scripts/no-paid-network.js --test test/integration/customer-plugin-package.test.js`

Expected: FAIL because `scripts/package-customer-plugin.js` does not exist.

- [ ] **Step 3: Implement orchestration and cleanup**

Create a temporary staging root with `fs.mkdtemp`, call stage, verify, archive, extract-and-verify, and always remove staging in `finally`. The direct-execution path prints only the three final artifact paths and never prints environment variables.

- [ ] **Step 4: Register scripts and syntax coverage**

Add:

```json
"package:customer-plugin": "node ./scripts/package-customer-plugin.js",
"test:customer-plugin": "node --import ./scripts/no-paid-network.js --test test/unit/customer-plugin-*.test.js test/integration/customer-plugin-package.test.js test/e2e/customer-plugin-install.e2e.test.js"
```

Ensure `scripts/check-syntax.js` already descends into `scripts/customer-plugin/`, and extend its test to assert the new modules are discovered.

- [ ] **Step 5: Add credential-free CI gates**

Add `npm run test:customer-plugin` to CI after the normal API coverage test. Do not provide PixVerse credentials. Keep `npm audit --audit-level=high` and `npm run security:scan` as required gates.

- [ ] **Step 6: Document the local-only build and release boundary**

Update `README.md` with the exact build command, generated artifact paths, Node/macOS prerequisites, checksum verification, legal-draft restriction, and statement that the command does not publish, upload, install remotely, or call paid APIs.

- [ ] **Step 7: Run the packaging integration test and commit**

```bash
npm run test:customer-plugin
git add scripts/package-customer-plugin.js test/integration/customer-plugin-package.test.js package.json scripts/check-syntax.js .github/workflows/ci.yml README.md
git commit -m "feat: package the macOS Codex plugin"
```

---

### Task 7: Build and Review the Local Demo Candidate

**Files:**
- Generated only: `dist/customer-plugin/0.3.0-beta.1/*`
- Modify only if a gate exposes a defect: files introduced in Tasks 1–6 and their matching tests.

**Interfaces:**
- Consumes: complete repository and `npm run package:customer-plugin`.
- Produces: one locally verified candidate ZIP, checksum sidecar, and release report; no remote state changes.

- [ ] **Step 1: Run all source and security gates**

```bash
npm run check
npm run test:coverage
npm run test:customer-plugin
npm run security:scan
npm audit --audit-level=high
```

Expected: all pass; production source coverage is at least 80% in every configured category.

- [ ] **Step 2: Build the candidate twice and verify determinism**

```bash
npm run package:customer-plugin
shasum -a 256 dist/customer-plugin/0.3.0-beta.1/pixverse-api-plugin-codex-0.3.0-beta.1.zip
npm run package:customer-plugin
shasum -a 256 dist/customer-plugin/0.3.0-beta.1/pixverse-api-plugin-codex-0.3.0-beta.1.zip
```

Expected: both SHA-256 values are identical and match the `.zip.sha256` sidecar and `release-report.json`.

- [ ] **Step 3: Inspect the exact archive inventory**

Run `unzip -Z1` and reject any path outside the approved tree. Confirm no `.git`, `.env`, source map, internal doc, customer material, test fixture, dev dependency, symlink, or absolute path is present.

- [ ] **Step 4: Perform independent code and security reviews**

Review the staging allowlist, archive verifier, command quoting, path containment, receipt-scoped deletion, secret redaction, no-paid-network behavior, and billable-operation guidance. Fix critical or high findings with a failing regression test before implementation changes.

- [ ] **Step 5: Run a clean-home installation rehearsal**

Use an isolated temporary `HOME` and fake Codex binary, then use a separate disposable Codex profile if available. Confirm marketplace registration, plugin installation, new-task skill pickup instructions, wrapper help, and uninstall. Do not configure live credentials or submit generation.

- [ ] **Step 6: Commit only source changes from final fixes**

```bash
git add package.json package-lock.json .gitignore .github README.md docs/api packaging scripts src test
git diff --cached --check
git commit -m "test: verify Codex plugin release candidate"
```

Do not add `dist/` and do not stage unrelated job, pitch, asset, payload, or workspace files.

- [ ] **Step 7: Report the local candidate**

Provide the absolute paths to the ZIP, checksum, and release report; summarize verification results and the legal-draft sharing restriction. Do not push, publish, upload, or move the archive to another Mac without a new explicit request.
