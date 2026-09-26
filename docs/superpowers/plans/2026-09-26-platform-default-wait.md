# Platform Default-Wait CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every billable `pixverse-api platform` command wait for a terminal result by default, with explicit `--no-wait` asynchronous execution and recoverable durable artifacts.

**Architecture:** Keep waiting as a CLI orchestration choice passed into the existing `submitPlatformJob` lifecycle; do not change Platform HTTP operations or polling internals. Both specialized billable commands and `run-job` share the same `poll`, timing, conflict, and recovery contract, while non-billable commands reject wait-only flags.

**Tech Stack:** Node.js 22+, ES modules, built-in `node:test`, loopback HTTP integration fixtures, existing durable Platform job artifacts.

**Spec:** `docs/superpowers/specs/2026-09-26-platform-default-wait-design.md`

## Global Constraints

- Billable specialized Platform commands and `platform run-job` wait by default.
- `--no-wait` returns after one accepted submission and never starts detached background polling.
- `--poll` remains an explicit-wait compatibility alias; combining it with `--no-wait` fails before submission.
- Read-only and other non-billable commands remain immediate and reject wait-only flags.
- New billable jobs keep fresh trace IDs, submit exactly once, and preserve the job directory and result ID before polling.
- A timeout remains recoverable through `platform resume`; recovery never resubmits generation.
- JSON stdout remains one machine-readable command result.
- No new runtime dependency is required.
- Tests must not contact paid PixVerse production endpoints.

---

## File Structure

- `src/platform/cli.js` — owns Platform CLI option parsing, wait defaults, conflict validation, job-runner options, and help text.
- `test/unit/platform-jobs.test.js` — verifies orchestration flags reach the durable job layer and invalid combinations fail before submission.
- `test/integration/platform-cli.test.js` — verifies the default-wait path against a loopback Platform server and preserves an explicit one-request `--no-wait` path.
- `README.md` — documents the customer-facing default-wait and asynchronous recovery commands.
- `.agents/skills/pixverse-platform-api/SKILL.md` — tells agents that default execution waits and `--no-wait` is the opt-out.
- `.agents/skills/pixverse-platform-api/references/workflows-and-recovery.md` — updates concrete safe-execution examples and recovery guidance.
- `test/platform-skill.test.js` — prevents skill documentation from drifting back to the old `--poll`-required behavior.

### Task 1: CLI wait controls and unit contract

**Files:**
- Modify: `test/unit/platform-jobs.test.js:169-212,258-279`
- Modify: `src/platform/cli.js:29-125,54-62,173-194`

**Interfaces:**
- Consumes: `submitPlatformJob(client, operationId, input, options)` where `options.poll` selects accepted-only versus terminal polling.
- Produces: specialized and generic job options `{ poll: boolean, intervalMs?: number, timeoutMs?: number }`; `--no-wait` maps to `poll: false`, default and `--poll` map to `poll: true`.

- [ ] **Step 1: Change the catalog-wide unit expectation to default waiting**

Replace the final assertion in `every billable catalog command delegates through the durable job layer`:

```js
assert.equal(calls.every(({ options }) => options.poll === true && options.jobRoot === root), true);
```

- [ ] **Step 2: Add failing tests for all wait modes and timing propagation**

Extend `test/unit/platform-jobs.test.js` with a test that invokes the generic and specialized command surfaces through injected `submitPlatformJob`:

```js
test("Platform commands wait by default and expose explicit asynchronous execution", async (t) => {
  const root = await createTempJobRoot(t);
  const payloadPath = path.join(root, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    prompt: "safe product shot", model: "v6", duration: 5,
    quality: "720p", aspect_ratio: "16:9",
  }));
  const calls = [];
  const context = {
    client: {}, cwd: root, jobRoot: root,
    submitPlatformJob: async (...args) => {
      calls.push(args);
      return { status: args[3].poll ? "succeeded" : "submitted" };
    },
  };

  await runPlatformCommand(["video", "text", "--payload", payloadPath], context);
  await runPlatformCommand(["video", "text", "--payload", payloadPath, "--no-wait"], context);
  await runPlatformCommand([
    "run-job", "--operation", "video.text", "--payload", payloadPath,
    "--interval-ms", "25", "--timeout-ms", "500",
  ], context);
  await runPlatformCommand([
    "run-job", "--operation", "video.text", "--payload", payloadPath, "--poll",
  ], context);

  assert.deepEqual(calls.map(([, , , options]) => options.poll), [true, false, true, true]);
  assert.equal(calls[2][3].intervalMs, 25);
  assert.equal(calls[2][3].timeoutMs, 500);
});
```

Add pre-submission rejection cases to `job command boundary rejects unsafe or incomplete recovery controls`:

```js
["run-job", "--operation", "video.text", "--payload", "x.json", "--poll", "--no-wait"],
["video", "text", "--payload", "x.json", "--poll", "--no-wait"],
["account", "balance", "--no-wait"],
["video", "status", "42", "--poll"],
```

Use a context whose injected submitter increments a counter and assert the counter stays zero for these option-validation failures.

- [ ] **Step 3: Run the focused unit test and confirm RED**

Run:

```bash
node --import ./scripts/no-paid-network.js --test test/unit/platform-jobs.test.js
```

Expected: FAIL because current billable commands pass `poll: false`, specialized commands reject `--no-wait`, and `run-job` defaults to no polling.

- [ ] **Step 4: Implement immutable wait-option parsing in `src/platform/cli.js`**

Change specialized execution so billable operations pass the parsed choice and timing values:

```js
if (operation.billing === "billable") {
  return (context.submitPlatformJob ?? submitPlatformJob)(client, operation.id, input, {
    ...jobOptions(context),
    poll: options.poll,
    intervalMs: options.intervalMs ?? context.intervalMs,
    timeoutMs: options.timeoutMs ?? context.timeoutMs,
  });
}
```

Initialize generic jobs with waiting enabled:

```js
function parseJobOptions(args) {
  let options = { poll: true };
  // parse each option by replacing options with a new object
}
```

Initialize specialized options according to billing class:

```js
function parseSpecializedOptions(args, operation) {
  let options = { positional: [], poll: operation.billing === "billable" };
  // parse each option by replacing options with a new object
}
```

Add focused helpers and use them from both parsers:

```js
function applyWaitMode(options, mode, operation) {
  if (operation && operation.billing !== "billable") {
    throw cliError("Wait options are available only for billable Platform commands.",
      "INVALID_PLATFORM_WAIT_OPTION", operation.id);
  }
  if (options.waitMode && options.waitMode !== mode) {
    throw cliError("--poll cannot be combined with --no-wait.",
      "CONFLICTING_PLATFORM_WAIT_OPTIONS", operation?.id);
  }
  return { ...options, waitMode: mode, poll: mode === "wait" };
}

function applyTimingOption(options, field, value, operation) {
  if (operation && operation.billing !== "billable") {
    throw cliError("Polling timing options are available only for billable Platform commands.",
      "INVALID_PLATFORM_WAIT_OPTION", operation.id);
  }
  return { ...options, [field]: value };
}
```

Parse these flags on both surfaces:

```js
if (arg === "--poll") options = applyWaitMode(options, "wait", operation);
else if (arg === "--no-wait") options = applyWaitMode(options, "no-wait", operation);
else if (arg === "--interval-ms") {
  options = applyTimingOption(options, "intervalMs", readPositiveNumberOption(args, ++index, arg), operation);
} else if (arg === "--timeout-ms") {
  options = applyTimingOption(options, "timeoutMs", readNonNegativeNumberOption(args, ++index, arg), operation);
}
```

For `run-job`, call the same helpers without an operation argument while parsing, then validate the resolved operation before submission as today. Do not pass the internal `waitMode` field into `submitPlatformJob`.

- [ ] **Step 5: Update Platform help text in the same implementation**

Render wait flags only for billable specialized operations:

```js
const commands = PLATFORM_OPERATIONS.map((operation) => {
  const waitHelp = operation.billing === "billable" ? " [--no-wait]" : "";
  return `  pixverse-api platform ${operation.command.join(" ")} [--payload <path>] [--dry-run]${waitHelp}`;
});
commands.push("  pixverse-api platform run-job --operation <operation-id> --payload <path> [--no-wait]");
commands.push("  pixverse-api platform resume <job-directory>");
```

- [ ] **Step 6: Run focused unit and catalog tests and confirm GREEN**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  test/unit/platform-jobs.test.js \
  test/catalog-completeness.test.js
```

Expected: PASS with no production network access.

- [ ] **Step 7: Commit the CLI contract**

```bash
git add src/platform/cli.js test/unit/platform-jobs.test.js test/catalog-completeness.test.js
git commit -m "feat: wait for platform jobs by default"
```

### Task 2: Loopback integration behavior and recovery evidence

**Files:**
- Modify: `test/integration/platform-cli.test.js:13-55`
- Verify without modification unless a failure identifies a defect: `src/platform/jobs.js`
- Verify without modification unless a failure identifies a defect: `test/e2e/platform-recovery.e2e.test.js`

**Interfaces:**
- Consumes: the Task 1 CLI contract and existing `video.status` path `/openapi/v2/video/result/{video_id}`.
- Produces: integration evidence that default execution submits once, polls the known ID, and returns a terminal durable result; `--no-wait` still performs exactly one HTTP request.

- [ ] **Step 1: Preserve the existing one-request integration case as explicit `--no-wait`**

Change the invocation in `catalog commands read --payload and produce a stable JSON-safe result over loopback`:

```js
const result = await runPlatformCommand([
  "video", "text", "--payload", payloadPath, "--no-wait",
], {
  env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY, PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
  fetchImpl: globalThis.fetch,
  cwd: directory,
});
```

Assert `result.status === "submitted"`, the string result ID is present, and the durable `job_dir` exists. Retain `server.requests.length === 1`.

- [ ] **Step 2: Add a failing default-wait loopback integration test**

Add a server handler that returns a create response once and terminal status on the known ID:

```js
test("billable Platform commands submit once and wait for the known ID by default", async (t) => {
  let creates = 0;
  let statusReads = 0;
  const server = await createMockApiServer((request, response) => {
    if (request.url === "/openapi/v2/video/text/generate") {
      creates += 1;
      sendJson(response, { ErrCode: 0, ErrMsg: "success", Resp: { video_id: "42" } });
      return;
    }
    assert.equal(request.url, "/openapi/v2/video/result/42");
    statusReads += 1;
    sendJson(response, { ErrCode: 0, ErrMsg: "success", Resp: { id: "42", status: 1 } });
  });
  t.after(() => server.close());
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "platform-default-wait-"));
  const payloadPath = path.join(directory, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    prompt: "quiet product shot", model: "v6", duration: 5,
    quality: "720p", aspect_ratio: "16:9",
  }));

  const result = await runPlatformCommand(["video", "text", "--payload", payloadPath], {
    env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY, PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
    fetchImpl: globalThis.fetch,
    cwd: directory,
    sleep: async () => {},
  });

  assert.equal(creates, 1);
  assert.equal(statusReads, 1);
  assert.equal(result.id, "42");
  assert.equal(result.status, "succeeded");
  assert.equal(result.terminal, true);
});
```

- [ ] **Step 3: Run integration and recovery tests and confirm behavior**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  test/integration/platform-cli.test.js \
  test/e2e/platform-recovery.e2e.test.js
```

Expected: PASS; create count is exactly one and recovery tests still prove resume never resubmits.

- [ ] **Step 4: Inspect generated loopback artifacts**

In the integration test, read `request.json`, `video-id.json`, `polling.jsonl`, and `final.json` from `result.job_dir` and assert:

```js
assert.equal(idArtifact.video_id, "42");
assert.equal(polling.at(-1).status, "succeeded");
assert.equal(final.status, "succeeded");
assert.equal(final.id, "42");
```

Use `readJobArtifacts` from `test/helpers/temp-job-dir.js` instead of ad hoc parsing so artifact verification follows existing repository patterns.

- [ ] **Step 5: Commit the integration evidence**

```bash
git add test/integration/platform-cli.test.js
git commit -m "test: cover platform default wait flow"
```

### Task 3: Customer and agent documentation

**Files:**
- Modify: `test/platform-skill.test.js:176-190`
- Modify: `README.md:158-172,215-224,292-301`
- Modify: `.agents/skills/pixverse-platform-api/SKILL.md:24-31`
- Modify: `.agents/skills/pixverse-platform-api/references/workflows-and-recovery.md:10-55`

**Interfaces:**
- Consumes: the implemented CLI flags from Tasks 1–2.
- Produces: one public command story: default wait, explicit `--no-wait`, and `resume` from the returned durable job directory.

- [ ] **Step 1: Add failing documentation contract assertions**

Extend `workflow and troubleshooting guidance preserves paid-call and webhook invariants` in `test/platform-skill.test.js`:

```js
assert.match(workflow, /waits? by default/i);
assert.match(workflow, /--no-wait/);
assert.match(workflow, /resume/);
assert.doesNotMatch(workflow, /run-job[^\n]*--poll/);
```

Load the root README inside the same test, then add equivalent assertions:

```js
const readme = await fs.readFile(path.join(ROOT, "README.md"), "utf8");
assert.match(readme, /platform run-job[^\n]*--no-wait/);
assert.match(readme, /Platform billable jobs wait by default/i);
```

- [ ] **Step 2: Run the documentation contract test and confirm RED**

Run:

```bash
node --import ./scripts/no-paid-network.js --test test/platform-skill.test.js
```

Expected: FAIL because the current workflow still requires `--poll` and does not describe default waiting.

- [ ] **Step 3: Update README examples and recovery wording**

Replace the primary Platform billable example with default waiting:

```bash
pixverse-api platform run-job --operation video.image --payload /absolute/path/image-video.json
```

Add the asynchronous form immediately below it:

```bash
pixverse-api platform run-job --operation video.image --payload /absolute/path/image-video.json --no-wait
pixverse-api platform resume /absolute/path/pixverse-api-jobs/platform/<job-dir>
```

Add this concise rule in the Safety section:

```markdown
- Platform billable jobs wait by default. Use `--no-wait` to return after acceptance, then use `resume` with the saved job directory; neither path resubmits generation.
```

Update the durable-artifact paragraph so it says default waiting writes polling snapshots and `--no-wait` writes the accepted request and known ID for later resume.

- [ ] **Step 4: Update agent skill execution guidance**

Change steps 4–5 of `.agents/skills/pixverse-platform-api/SKILL.md` to:

```markdown
4. Submit once with a fresh trace ID, preferably through `run-job`; Platform billable commands wait by default and preserve the job directory, result ID, polling history, and terminal result.
5. Use `--no-wait` only when asynchronous return is required, then continue the known job with `resume`. If submission was ambiguous and no result ID was saved, stop at `reconciliation_required`; do not resubmit.
```

- [ ] **Step 5: Update workflow examples**

Remove `--poll` from primary `run-job` examples in `workflows-and-recovery.md`. Add an asynchronous subsection containing:

```markdown
Platform billable commands wait for a terminal result by default. To return immediately after acceptance, add `--no-wait`; preserve the returned job directory and later run `npm run cli -- platform resume <job-directory>`. Resume polls the saved result ID and never repeats generation.
```

- [ ] **Step 6: Run documentation and help tests and confirm GREEN**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  test/platform-skill.test.js \
  test/catalog-completeness.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit the documentation contract**

```bash
git add README.md \
  .agents/skills/pixverse-platform-api/SKILL.md \
  .agents/skills/pixverse-platform-api/references/workflows-and-recovery.md \
  test/platform-skill.test.js
git commit -m "docs: explain platform default waiting"
```

### Task 4: Full verification and final review

**Files:**
- Review: all files changed in Tasks 1–3
- Do not stage: existing unrelated untracked job artifacts, payloads, campaign scripts, or `.superpowers/`

**Interfaces:**
- Consumes: completed implementation, integration evidence, and documentation.
- Produces: a release-ready local branch with passing quality and security gates.

- [ ] **Step 1: Run syntax and focused safety checks**

```bash
npm run check
npm run security:scan
npm audit --audit-level=high
```

Expected: all commands exit zero; audit reports no high-severity vulnerability.

- [ ] **Step 2: Run the complete API suite**

```bash
npm run test:api
```

Expected: all API, contract, integration, E2E, skill, and no-paid-network tests pass.

- [ ] **Step 3: Verify coverage remains above the repository threshold**

```bash
npm run test:coverage
```

Expected: lines, branches, functions, and statements are each at least 80%.

- [ ] **Step 4: Review the final diff and repository boundaries**

```bash
git diff --check
git status --short
git log --oneline --decorate -6
```

Confirm the diff contains only the CLI, tests, README, Platform skill, workflow guide, spec, and plan. Confirm unrelated untracked job outputs remain untouched.

- [ ] **Step 5: Perform a security-focused review**

Verify no API key, authorization header, webhook secret, private media URL, or customer data was added. Confirm `--no-wait` never creates a detached process, conflict validation happens before paid submission, and default waiting cannot issue more than the single create request.

- [ ] **Step 6: Record completion**

If review requires a correction, add the smallest test-first fix and commit it with a conventional `fix:` or `test:` message. Otherwise, report the three implementation commits, test totals, coverage, and that the branch is local until the user explicitly asks to push.
