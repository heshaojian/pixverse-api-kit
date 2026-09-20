# Growth Studio PDP Agent Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a merchant-neutral, agent-safe PDP video workflow to the Growth Studio CLI and skill, backed by the current `/openapi/v1/ka/videos` API.

**Architecture:** A focused PDP contract module validates a public seller-neutral payload and immutably adds the private `ecommerce_fashion_pdp` wire type. The existing Growth Studio client, polling, artifact, and error primitives are reused through a PDP-specific durable submission path; wallet reads support preflight and reconciliation without changing legacy video behavior.

**Tech Stack:** Node.js 20+, ES modules, built-in `node:test`, Fetch API, existing PixVerse API Kit core artifacts/redaction/error helpers.

**Spec:** `docs/superpowers/specs/2026-09-20-growth-studio-pdp-agent-kit-design.md`

## Global Constraints

- Public naming is `PDP`; do not expose "KA video" as a command, skill capability, or customer-facing heading.
- PDP must be generic across sellers and merchants; do not add retailer domains, seller-specific fields, folders, defaults, or prompts.
- The current upstream PDP capability is for fashion/apparel products; do not imply support for unrelated product categories.
- Public PDP input contains only `product` and `video`; it does not accept `type`, `source_url`, `folder_id`, or arbitrary metadata.
- The internal request uses `POST /openapi/v1/ka/videos` and `type: "ecommerce_fashion_pdp"`.
- Create is billable, single-attempt, durable by default, and requires `--confirm-billable`; it is never retried automatically.
- `--dry-run` must work without credentials, files under `jobs/`, or network access.
- PDP resume is poll-only. Missing `video_id` produces `reconciliation_required` and never submits.
- Platform and Growth Studio credentials, configuration, and billing remain isolated.
- Preserve video, ledger, and money identifiers/amounts as strings.
- Tests must run under the no-paid-network guard and maintain at least 80% line, branch, function, and statement coverage.
- Do not perform a live PDP generation during implementation or verification.
- Do not place private Feishu document URLs in customer-shareable code, skills, or API documentation.

## File Map

- Create `src/growth-studio/pdp.js`: PDP schema, strict validation, immutable public-to-wire normalization, public dry-run descriptor.
- Create `src/growth-studio/wallet.js`: wallet ledger pagination normalization.
- Modify `src/core/errors.js`: preserve Growth Studio `requestId` as public `request_id` during safe serialization.
- Modify `src/growth-studio/client.js`: PDP create plus wallet balance/ledger methods and compatibility exports.
- Modify `src/growth-studio/jobs.js`: reusable durable submission core, `runPdpJob`, PDP artifact identity, ledger ID preservation, workflow-aware resume.
- Modify `src/growth-studio/cli.js`: `pdp` and `wallet` command trees, argument parsing, billing confirmation, dry run, lazy client creation.
- Create `test/unit/growth-studio-pdp.test.js`: strict contract and immutability tests.
- Modify `test/unit/core-errors.test.js`: request-ID serialization coverage.
- Modify `test/contract/growth-studio-client.contract.test.js`: HTTP path/header/body and wallet request contracts.
- Modify `test/unit/growth-studio-jobs.test.js`: PDP durable submission, artifacts, and recovery.
- Modify `test/unit/growth-studio-compatibility.test.js`: command parsing, lazy config, help, and unchanged legacy behavior.
- Modify `test/integration/growth-studio-cli.test.js`: in-process PDP and wallet CLI behavior.
- Modify `test/e2e/growth-studio-namespaced.e2e.test.js`: executable offline create-to-poll PDP workflow.
- Create `.agents/skills/pixverse-growth-studio-api/references/pdp-payload.json`: neutral reusable payload.
- Create `.agents/skills/pixverse-growth-studio-api/references/pdp-workflow.md`: agent selection, approval, submission, and recovery guide.
- Modify `.agents/skills/pixverse-growth-studio-api/SKILL.md`: expose PDP capability and route to references.
- Modify `.agents/skills/pixverse-api/SKILL.md`: include PDP in Growth Studio routing.
- Create `test/growth-studio-skill.test.js`: skill/reference structure, terminology, and neutral example checks.
- Modify `package.json`: include the Growth Studio skill test in API and coverage gates.
- Create `docs/api/growth-studio-pdp.md`: focused public PDP contract and agent workflow.
- Modify `README.md`, `docs/api/command-reference.md`, and `docs/api/safety-and-recovery.md`: public commands, payload rules, wallet reads, and recovery.

---

### Task 1: Build the strict PDP payload contract

**Files:**
- Create: `src/growth-studio/pdp.js`
- Create: `test/unit/growth-studio-pdp.test.js`

**Interfaces:**
- Produces: `PDP_WIRE_TYPE`, `PDP_CREATE_PATH`, `validatePdpPayload(payload)`, `normalizePdpPayload(payload)`, and `describePdpDryRun(payload)`.
- `normalizePdpPayload` returns a new deeply independent wire object with root `type`, `product`, and `video`.
- `describePdpDryRun` returns `{ capability, billable, method, path, body }` and performs the same validation as live submission.

- [ ] **Step 1: Write failing happy-path and immutability tests**

Create `test/unit/growth-studio-pdp.test.js` with this foundation:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  PDP_CREATE_PATH,
  PDP_WIRE_TYPE,
  describePdpDryRun,
  normalizePdpPayload,
  validatePdpPayload,
} from "../../src/growth-studio/pdp.js";

function validPayload(overrides = {}) {
  return {
    product: {
      title: "Linen Summer Shirt",
      description: "Breathable linen with a relaxed fit.",
      images: [
        { url: "https://media.pixverse.ai/example/front.webp" },
        { url: "https://media.pixverse.ai/example/back.webp" },
      ],
      brand: "Example Brand",
      price: { amount: "59.90", currency: "USD" },
      ...overrides.product,
    },
    video: {
      mode: "pro",
      duration: 10,
      quality: "high",
      aspect_ratio: "9:16",
      additional_prompt: "Soft morning light and clean product-focused styling.",
      ...overrides.video,
    },
    ...overrides.root,
  };
}

test("PDP normalization injects the private wire type without mutating caller input", () => {
  const payload = validPayload();
  const snapshot = structuredClone(payload);

  const normalized = normalizePdpPayload(payload);

  assert.deepEqual(payload, snapshot);
  assert.notEqual(normalized.product, payload.product);
  assert.notEqual(normalized.video, payload.video);
  assert.equal(normalized.type, PDP_WIRE_TYPE);
  assert.deepEqual(normalized.product, payload.product);
  assert.deepEqual(normalized.video, payload.video);
});

test("PDP dry run describes the exact non-billable wire request", () => {
  const result = describePdpDryRun(validPayload());
  assert.equal(result.capability, "pdp");
  assert.equal(result.billable, false);
  assert.equal(result.method, "POST");
  assert.equal(result.path, PDP_CREATE_PATH);
  assert.equal(result.body.type, "ecommerce_fashion_pdp");
});
```

- [ ] **Step 2: Run the PDP unit test and verify RED**

Run:

```bash
node --test test/unit/growth-studio-pdp.test.js
```

Expected: FAIL because `src/growth-studio/pdp.js` does not exist.

- [ ] **Step 3: Add exhaustive failing boundary and unknown-field tests**

Add table-driven cases covering:

```js
test("PDP rejects fields that the paid endpoint would ignore or reject", () => {
  const cases = [
    [validPayload({ root: { type: "ecommerce_fashion_pdp" } }), /Unknown PDP field: type/],
    [validPayload({ root: { folder_id: "630251570268735431" } }), /Unknown PDP field: folder_id/],
    [validPayload({ product: { source_url: "https:\/\/shop.example.test\/item" } }), /Unknown PDP product field: source_url/],
    [validPayload({ product: { seller: "Example Seller" } }), /Unknown PDP product field: seller/],
    [validPayload({ video: { resolution: "1080p" } }), /Unknown PDP video field: resolution/],
  ];
  for (const [payload, message] of cases) {
    assert.throws(() => validatePdpPayload(payload), message);
  }
});

test("PDP validates documented limits and enums", () => {
  const cases = [
    [validPayload({ product: { title: "" } }), /product.title/],
    [validPayload({ product: { title: "x".repeat(256) } }), /product.title/],
    [validPayload({ product: { description: "x".repeat(5121) } }), /product.description/],
    [validPayload({ product: { images: [] } }), /1 to 8/],
    [validPayload({ product: { images: Array.from({ length: 9 }, (_, index) => ({ url: `https:\/\/media.pixverse.ai\/${index}.webp` })) } }), /1 to 8/],
    [validPayload({ product: { images: [{ url: "https://media.pixverse.ai.evil.test/item.webp" }] } }), /media.pixverse.ai/],
    [validPayload({ product: { images: [{ url: "http://media.pixverse.ai/item.webp" }] } }), /HTTPS/],
    [validPayload({ product: { price: { amount: 59.9, currency: "USD" } } }), /price.amount/],
    [validPayload({ product: { price: { amount: "59.90", currency: "usd" } } }), /price.currency/],
    [validPayload({ video: { mode: "ultra" } }), /video.mode/],
    [validPayload({ video: { duration: 4 } }), /video.duration/],
    [validPayload({ video: { duration: 10.5 } }), /video.duration/],
    [validPayload({ video: { quality: "4k" } }), /video.quality/],
    [validPayload({ video: { aspect_ratio: "2:1" } }), /video.aspect_ratio/],
    [validPayload({ video: { additional_prompt: "x".repeat(2001) } }), /video.additional_prompt/],
  ];
  for (const [payload, message] of cases) {
    assert.throws(() => validatePdpPayload(payload), message);
  }
});
```

Also cover missing/non-object root, product, video, image entries, extra image/price fields, optional field types, a one-image standard-mode minimum payload, six accepted aspect ratios, durations 5 and 10, and absent optional brand/price/description/video options.

- [ ] **Step 4: Implement the minimal strict contract**

Create `src/growth-studio/pdp.js` with constants, exact-key checks, string/enum/range helpers, URL parsing, and immutable copies. The core public functions must follow this shape:

```js
export const PDP_WIRE_TYPE = "ecommerce_fashion_pdp";
export const PDP_CREATE_PATH = "/openapi/v1/ka/videos";

const ROOT_FIELDS = new Set(["product", "video"]);
const PRODUCT_FIELDS = new Set(["title", "description", "images", "brand", "price"]);
const IMAGE_FIELDS = new Set(["url"]);
const PRICE_FIELDS = new Set(["amount", "currency"]);
const VIDEO_FIELDS = new Set(["mode", "duration", "quality", "aspect_ratio", "additional_prompt"]);
const MODES = new Set(["standard", "pro"]);
const QUALITIES = new Set(["normal", "high"]);
const ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);

export function validatePdpPayload(payload) {
  assertPlainObject(payload, "PDP payload");
  assertKnownFields(payload, ROOT_FIELDS, "PDP");
  validateProduct(payload.product);
  validateVideo(payload.video);
}

export function normalizePdpPayload(payload) {
  validatePdpPayload(payload);
  return {
    type: PDP_WIRE_TYPE,
    product: {
      title: payload.product.title,
      ...(payload.product.description === undefined ? {} : { description: payload.product.description }),
      images: payload.product.images.map(({ url }) => ({ url })),
      ...(payload.product.brand === undefined ? {} : { brand: payload.product.brand }),
      ...(payload.product.price === undefined ? {} : { price: { ...payload.product.price } }),
    },
    video: { ...payload.video },
  };
}

export function describePdpDryRun(payload) {
  return {
    capability: "pdp",
    billable: false,
    method: "POST",
    path: PDP_CREATE_PATH,
    body: normalizePdpPayload(payload),
  };
}
```

For media URLs, parse with `new URL(url)` and require `origin === "https://media.pixverse.ai"`, empty username/password, no explicit port, and `hostname === "media.pixverse.ai"`; do not use prefix matching.

- [ ] **Step 5: Run the focused tests and refactor while green**

Run:

```bash
node --test test/unit/growth-studio-pdp.test.js
npm run check
```

Expected: all PDP tests pass and syntax checking succeeds.

- [ ] **Step 6: Commit the PDP contract**

```bash
git add src/growth-studio/pdp.js test/unit/growth-studio-pdp.test.js
git commit -m "feat: add merchant-neutral PDP contract"
```

---

### Task 2: Add PDP and wallet HTTP client methods

**Files:**
- Create: `src/growth-studio/wallet.js`
- Modify: `src/core/errors.js`
- Modify: `src/growth-studio/client.js`
- Modify: `test/contract/growth-studio-client.contract.test.js`
- Modify: `test/unit/core-errors.test.js`
- Modify: `test/unit/growth-studio-compatibility.test.js`

**Interfaces:**
- Produces `normalizeWalletLedgerOptions(options)` returning integer `{ offset, limit }` with defaults `{ offset: 0, limit: 20 }`.
- Adds `GrowthStudioClient.createPdpVideo(payload, options)`.
- Adds `GrowthStudioClient.getWalletBalance(options)`.
- Adds `GrowthStudioClient.listWalletLedgers(options)`.
- Re-exports PDP and wallet helpers through `src/growth-studio/client.js`, and therefore through the existing flat `src/client.js` compatibility export.

- [ ] **Step 1: Write failing PDP client contract tests**

Extend `test/contract/growth-studio-client.contract.test.js`:

```js
test("Growth Studio PDP uses bearer auth and the exact PDP wire contract", async () => {
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({
      video_id: "627410861853514292",
      status: "processing",
      ledger_source_id: "627410861853514292",
      request_id: "pdp-create-fixture",
    }, { status: 202, headers: { location: "/openapi/v1/videos/627410861853514292" } }),
  ]);
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "growth-fixture-key",
    baseUrl: "https://growth.example.test",
    fetchImpl,
  });

  const result = await client.createPdpVideo({
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "standard" },
  }, { traceId: "pdp-create-fixture" });

  assert.equal(result.body.video_id, "627410861853514292");
  assert.equal(calls[0].method, "POST");
  assert.equal(new URL(calls[0].url).pathname, "/openapi/v1/ka/videos");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer growth-fixture-key");
  assert.equal(calls[0].headers.get("Ai-Trace-Id"), "pdp-create-fixture");
  assert.equal(calls[0].headers.has("API-KEY"), false);
  assert.deepEqual(await describeRecordedBody(calls[0].body), {
    type: "ecommerce_fashion_pdp",
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "standard" },
  });
});
```

- [ ] **Step 2: Write failing wallet query contract tests**

Add tests proving:

```js
test("Growth Studio wallet methods preserve formatted strings and validated pagination", async () => {
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({
      currency: "USD",
      available_amount: "1280.00",
      refund_pending_amount: "0.00",
      status: "normal",
      free_chances: 0,
    }),
    jsonResponse({
      data: [{
        ledger_id: "7412590000000000010",
        type: "video_consume",
        amount: "-1.00",
        source_type: "video",
        source_id: "627410861853514292",
      }],
      pagination: { offset: 20, limit: 10, total: 31 },
    }),
  ]);
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "growth-fixture-key",
    baseUrl: "https://growth.example.test",
    fetchImpl,
  });

  const balance = await client.getWalletBalance({ traceId: "balance-fixture" });
  const ledger = await client.listWalletLedgers({ offset: 20, limit: 10, traceId: "ledger-fixture" });

  assert.equal(balance.body.available_amount, "1280.00");
  assert.equal(ledger.body.data[0].amount, "-1.00");
  assert.equal(ledger.body.data[0].source_id, "627410861853514292");
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), [
    "/openapi/v1/wallet/balance",
    "/openapi/v1/wallet/ledgers",
  ]);
  assert.equal(new URL(calls[1].url).search, "?offset=20&limit=10");
});
```

Create wallet unit assertions for default values, numeric strings from CLI normalization, negative offset, limit 0/101, fractions, `NaN`, `Infinity`, and unknown options.

- [ ] **Step 3: Run the client tests and verify RED**

Run:

```bash
node --test test/contract/growth-studio-client.contract.test.js test/unit/growth-studio-compatibility.test.js
```

Expected: FAIL because the new PDP/wallet methods and exports are absent.

- [ ] **Step 4: Implement wallet option normalization**

Create `src/growth-studio/wallet.js`:

```js
const WALLET_OPTION_FIELDS = new Set(["offset", "limit", "traceId"]);

export function normalizeWalletLedgerOptions(options = {}) {
  assertKnownOptionFields(options);
  return {
    offset: readInteger(options.offset ?? 0, "offset", { minimum: 0 }),
    limit: readInteger(options.limit ?? 20, "limit", { minimum: 1, maximum: 100 }),
  };
}
```

`readInteger` accepts only a safe integer number. It rejects strings, signs, decimals, `NaN`, infinities, and unsafe integers. The CLI is responsible for converting its text arguments before calling the client boundary.

- [ ] **Step 5: Implement client methods and compatibility exports**

In `src/growth-studio/client.js`, import the contract helpers and add:

```js
import { normalizePdpPayload } from "./pdp.js";
import { normalizeWalletLedgerOptions } from "./wallet.js";

export {
  PDP_CREATE_PATH,
  PDP_WIRE_TYPE,
  describePdpDryRun,
  normalizePdpPayload,
  validatePdpPayload,
} from "./pdp.js";
export { normalizeWalletLedgerOptions } from "./wallet.js";

// Inside GrowthStudioClient:
async createPdpVideo(payload, options = {}) {
  return this.request("POST", "/ka/videos", {
    json: normalizePdpPayload(payload),
    traceId: options.traceId,
  });
}

async getWalletBalance(options = {}) {
  return this.request("GET", "/wallet/balance", { traceId: options.traceId });
}

async listWalletLedgers(options = {}) {
  const query = normalizeWalletLedgerOptions(options);
  return this.request("GET", "/wallet/ledgers", {
    query,
    traceId: options.traceId,
  });
}
```

Update the flat export compatibility test to assert the new named exports are identical. Do not change `createVideo` or existing paths.

- [ ] **Step 6: Preserve request IDs in safe error serialization**

First extend `test/unit/core-errors.test.js` so a `PixverseCliError` and an ordinary error-like API error with `requestId: "request-fixture"` serialize with `request_id: "request-fixture"`. Then add this mapping to `PUBLIC_FIELDS` in `src/core/errors.js`:

```js
["requestId", "request_id"],
```

This preserves the upstream troubleshooting/reconciliation identifier without exposing stacks or secrets.

- [ ] **Step 7: Run focused client and compatibility tests**

Run:

```bash
node --test \
  test/unit/growth-studio-pdp.test.js \
  test/unit/core-errors.test.js \
  test/contract/growth-studio-client.contract.test.js \
  test/unit/growth-studio-compatibility.test.js \
  test/client.test.js
```

Expected: all pass.

- [ ] **Step 8: Commit the HTTP client work**

```bash
git add src/core/errors.js src/growth-studio/client.js src/growth-studio/wallet.js \
  test/contract/growth-studio-client.contract.test.js \
  test/unit/core-errors.test.js \
  test/unit/growth-studio-compatibility.test.js
git commit -m "feat: add PDP and wallet client methods"
```

---

### Task 3: Add durable PDP submission and recovery

**Files:**
- Modify: `src/growth-studio/jobs.js`
- Modify: `test/unit/growth-studio-jobs.test.js`

**Interfaces:**
- Produces `runPdpJob(client, publicPayload, options)`.
- Extends `resumeGrowthStudioJob(client, jobDirectory, options)` with optional `expectedWorkflow` validation while preserving existing callers.
- PDP job result adds `workflow: "pdp"` and `ledger_source_id`; existing general video job result stays compatible.

- [ ] **Step 1: Write a failing durable PDP job test**

Add to `test/unit/growth-studio-jobs.test.js`:

```js
import { resumeGrowthStudioJob, runGrowthStudioJob, runPdpJob } from "../../src/growth-studio/jobs.js";

test("PDP jobs submit once and persist exact wire and reconciliation identifiers", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-job-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let submissions = 0;
  const publicPayload = {
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "pro", duration: 10 },
  };

  const result = await runPdpJob({
    async createPdpVideo(received) {
      submissions += 1;
      assert.deepEqual(received, publicPayload);
      return { body: {
        video_id: "627410861853514292",
        ledger_source_id: "627410861853514292",
        status: "processing",
      } };
    },
  }, publicPayload, {
    jobsDir: root,
    poll: false,
    traceId: "pdp-fixture",
  });

  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));
  const ledger = JSON.parse(await fs.readFile(path.join(result.job_dir, "ledger-source-id.json"), "utf8"));
  assert.equal(submissions, 1);
  assert.equal(request.workflow, "pdp");
  assert.equal(request.endpoint, "/openapi/v1/ka/videos");
  assert.equal(request.payload.type, "ecommerce_fashion_pdp");
  assert.equal(request.payload.product.source_url, undefined);
  assert.deepEqual(ledger, { ledger_source_id: "627410861853514292" });
  assert.equal(result.workflow, "pdp");
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.ledger_source_id, "627410861853514292");
});
```

- [ ] **Step 2: Write failing recovery and failure tests**

Add tests that prove:

- PDP polling writes `polling.jsonl` and terminal `final.json`.
- `pdp resume` with `expectedWorkflow: "pdp"` polls the saved ID without accessing `createPdpVideo`.
- PDP resume without a saved ID returns `reconciliation_required` with zero client accesses.
- PDP resume rejects a normal video job when `expectedWorkflow` is `pdp`.
- a create transport failure leaves `request.json` and redacted `error.json`, does not create `video-id.json`, and makes exactly one submission.
- a response with numeric `video_id` or numeric `ledger_source_id` fails rather than losing precision.
- an absent `ledger_source_id` is tolerated in the result but never synthesized.

Use a proxy or counters to assert no second submission path is touched.

- [ ] **Step 3: Run the job tests and verify RED**

Run:

```bash
node --test test/unit/growth-studio-jobs.test.js test/jobs.test.js
```

Expected: FAIL because `runPdpJob` and workflow-aware artifacts do not exist.

- [ ] **Step 4: Extract a private reusable durable submission core**

Refactor `src/growth-studio/jobs.js` without changing `runVideoJob` behavior. Use a private helper with an explicit submission callback:

```js
async function runDurableVideoSubmission(client, artifactPayload, options, submission) {
  const jobDir = await createJobDir(options.jobsDir || DEFAULT_JOBS_DIR, options.jobName);
  const traceBase = options.traceId || path.basename(jobDir);
  try {
    await writeArtifact(jobDir, "request.json", redact({
      provider: "growth-studio",
      ...(options.workflow ? { workflow: options.workflow } : {}),
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      trace_id: traceBase,
      created_at: new Date().toISOString(),
      payload: artifactPayload,
    }));
    const createResult = await submission({ traceId: `${traceBase}-create` });
    return persistCreatedVideo(client, jobDir, createResult, traceBase, options);
  } catch (error) {
    await persistFailure(jobDir, error, traceBase);
    throw error;
  }
}
```

Keep folder resolution in `runVideoJob` before this helper and pass the existing `client.createVideo` callback. Do not add PDP fields to old artifacts unless explicitly supplied in options.

- [ ] **Step 5: Implement `runPdpJob` and string-ID persistence**

Add:

```js
import { PDP_CREATE_PATH, normalizePdpPayload } from "./pdp.js";

export async function runPdpJob(client, publicPayload, options = {}) {
  const wirePayload = normalizePdpPayload(publicPayload);
  return runDurableVideoSubmission(client, wirePayload, {
    ...options,
    workflow: "pdp",
    endpoint: PDP_CREATE_PATH,
  }, (requestOptions) => client.createPdpVideo(publicPayload, requestOptions));
}
```

Move response persistence into `persistCreatedVideo`. Require `video_id` to be a non-empty string. If `ledger_source_id` exists, require a non-empty string, write `ledger-source-id.json`, and include it in the returned result. Pass workflow through `resultFromFinal` without mutating final response objects.

- [ ] **Step 6: Add workflow-aware poll-only resume**

After reading `request.json`, enforce only when the caller supplies an expectation:

```js
if (options.expectedWorkflow && request.workflow !== options.expectedWorkflow) {
  throw new Error(`Growth Studio job is not a ${options.expectedWorkflow} workflow.`);
}
```

Read the optional saved ledger ID into resume results. Never call a create method from resume.

- [ ] **Step 7: Run focused and regression job tests**

Run:

```bash
node --test test/unit/growth-studio-jobs.test.js test/jobs.test.js test/unit/growth-studio-compatibility.test.js
```

Expected: all existing and new job tests pass.

- [ ] **Step 8: Commit durable PDP jobs**

```bash
git add src/growth-studio/jobs.js test/unit/growth-studio-jobs.test.js
git commit -m "feat: add durable PDP job recovery"
```

---

### Task 4: Expose PDP and wallet commands

**Files:**
- Modify: `src/growth-studio/cli.js`
- Modify: `test/unit/growth-studio-compatibility.test.js`
- Modify: `test/integration/growth-studio-cli.test.js`
- Modify: `test/e2e/growth-studio-namespaced.e2e.test.js`

**Interfaces:**
- `runGrowthStudioCommand(["pdp", "create", ...], context)` supports dry-run or confirmed durable submission.
- `pdp get`, `pdp poll`, and `pdp resume` use the shared details/poll/resume mechanisms.
- `wallet balance` and `wallet ledgers` are read-only.
- No new legacy aliases are added.

- [ ] **Step 1: Write failing command adapter tests**

In `test/unit/growth-studio-compatibility.test.js`, add fixtures for a valid PDP file and assert:

```js
test("PDP dry run validates without credentials, artifacts, or network", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-dry-run-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const payloadPath = path.join(root, "pdp.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "standard" },
  }));
  let clientAccesses = 0;
  const result = await runGrowthStudioCommand([
    "pdp", "create", "--payload", payloadPath, "--dry-run",
  ], {
    env: {},
    cwd: root,
    get client() { clientAccesses += 1; return {}; },
  });

  assert.equal(result.billable, false);
  assert.equal(result.body.type, "ecommerce_fashion_pdp");
  assert.equal(clientAccesses, 0);
  assert.deepEqual(await fs.readdir(root), ["pdp.json"]);
});
```

Also assert:

- live create without `--confirm-billable` rejects before client/config access;
- `--confirm-billable` and `--dry-run` together reject;
- `--dry-run` combined with job, polling, or `--no-poll` options rejects rather than silently ignoring them;
- folder flags, a positional URL, and unknown options reject;
- `pdp get` calls `getVideo` once;
- `pdp poll` passes parsed bounded timing options to `pollVideo`;
- `pdp resume` passes `expectedWorkflow: "pdp"` and is reconciliation-safe without config;
- wallet commands call the new client methods and preserve string amounts;
- invalid ledger pagination rejects before config;
- `GROWTH_STUDIO_LEGACY_COMMAND_MAPPINGS` is unchanged.

- [ ] **Step 2: Write a failing offline executable E2E test**

Extend `test/e2e/growth-studio-namespaced.e2e.test.js` with a loopback server that expects exactly:

```text
POST /openapi/v1/ka/videos
GET /openapi/v1/videos/627410861853514292
```

Run the executable command:

```js
const result = await runCli([
  "growth-studio",
  "pdp",
  "create",
  "--payload", payloadPath,
  "--confirm-billable",
  "--jobs-dir", jobsDir,
  "--initial-delay-seconds", "0",
  "--fallback-delay-seconds", "0",
], {
  cwd: tempRoot,
  env: {
    PIXVERSE_GROWTH_API_KEY: "mh_live_fixture",
    PIXVERSE_GROWTH_BASE_URL: server.baseUrl,
  },
});
```

The mock create handler must assert the exact injected wire type, no `source_url`, bearer auth, absence of `API-KEY`, and return a string `video_id` plus matching `ledger_source_id`. Assert job artifacts and exactly one POST.

- [ ] **Step 3: Run command and E2E tests and verify RED**

Run:

```bash
node --test \
  test/unit/growth-studio-compatibility.test.js \
  test/integration/growth-studio-cli.test.js \
  test/e2e/growth-studio-namespaced.e2e.test.js
```

Expected: new PDP/wallet cases fail because routing is absent.

- [ ] **Step 4: Add PDP command parsing with validation before configuration**

Import `describePdpDryRun` and `runPdpJob`. Add a `pdp create` branch that parses the full option set before calling `getClient()`:

```js
if (resource === "pdp" && operation === "create") {
  const options = parsePdpCreateOptions(rest);
  if (!options.payloadPath) throw new Error("pdp create requires --payload <path>.");
  if (options.dryRun && options.confirmBillable) {
    throw new Error("pdp create accepts either --dry-run or --confirm-billable, not both.");
  }
  if (options.dryRun && hasPdpExecutionOptions(options)) {
    throw new Error("pdp create --dry-run does not accept job or polling options.");
  }
  const payload = await readJsonFile(resolveInputPath(context, options.payloadPath));
  if (options.dryRun) return describePdpDryRun(payload);
  if (!options.confirmBillable) {
    throw new Error("pdp create requires --confirm-billable for a live submission.");
  }
  return runPdpJob(getClient(), payload, toPdpJobOptions(options));
}
```

Resolve relative payload and job paths from `context.cwd`, not the process-global current directory. Keep objects immutable when translating parsed options.

- [ ] **Step 5: Add PDP read/recovery and wallet branches**

Implement:

```js
if (resource === "pdp" && operation === "get") {
  const [videoId, ...extra] = rest;
  if (!videoId || extra.length > 0) throw new Error("pdp get requires exactly one video_id.");
  return (await getClient().getVideo(videoId, { traceId: traceId("get-pdp") })).body;
}
if (resource === "pdp" && operation === "poll") {
  const options = parsePdpPollOptions(rest);
  return getClient().pollVideo(options.videoId, {
    traceId: traceId("poll-pdp"),
    timeoutMs: options.timeoutMinutes === undefined ? undefined : options.timeoutMinutes * 60 * 1000,
    initialDelaySeconds: options.initialDelaySeconds,
    fallbackDelaySeconds: options.fallbackDelaySeconds,
  });
}
if (resource === "pdp" && operation === "resume") {
  const options = parsePdpResumeOptions(rest);
  const jobDirectory = path.resolve(context.cwd ?? process.cwd(), options.jobDirectory);
  const resumeClient = context.client ?? createDeferredResumeClient(getClient);
  return (context.resumeGrowthStudioJob ?? resumeGrowthStudioJob)(resumeClient, jobDirectory, {
    expectedWorkflow: "pdp",
    timeoutMs: options.timeoutMinutes === undefined ? undefined : options.timeoutMinutes * 60 * 1000,
    initialDelaySeconds: options.initialDelaySeconds,
    fallbackDelaySeconds: options.fallbackDelaySeconds,
  });
}
if (resource === "wallet" && operation === "balance") {
  if (rest.length > 0) throw new Error("wallet balance does not accept arguments.");
  return (await getClient().getWalletBalance({ traceId: traceId("wallet-balance") })).body;
}
if (resource === "wallet" && operation === "ledgers") {
  const options = parseWalletLedgerOptions(rest);
  return (await getClient().listWalletLedgers({
    ...options,
    traceId: traceId("wallet-ledgers"),
  })).body;
}
```

Reuse one timing parser for PDP create/poll/resume and preserve the current general `run-job` and `resume` grammar. Reject extra positional arguments for `pdp get`, wallet balance, and PDP resume.

- [ ] **Step 6: Update Growth Studio help**

Add the exact public forms from the spec. Use “PDP video” and “billable”; do not use “KA video.” Keep legacy help entries unchanged.

- [ ] **Step 7: Run focused command, contract, and E2E tests**

Run:

```bash
node --test \
  test/unit/growth-studio-pdp.test.js \
  test/unit/growth-studio-jobs.test.js \
  test/unit/growth-studio-compatibility.test.js \
  test/contract/growth-studio-client.contract.test.js \
  test/integration/growth-studio-cli.test.js \
  test/e2e/growth-studio-namespaced.e2e.test.js
```

Expected: all pass with zero requests to production hosts.

- [ ] **Step 8: Commit the CLI surface**

```bash
git add src/growth-studio/cli.js \
  test/unit/growth-studio-compatibility.test.js \
  test/integration/growth-studio-cli.test.js \
  test/e2e/growth-studio-namespaced.e2e.test.js
git commit -m "feat: expose Growth Studio PDP commands"
```

---

### Task 5: Upgrade the Growth Studio agent skill and public documentation

**Files:**
- Create: `.agents/skills/pixverse-growth-studio-api/references/pdp-payload.json`
- Create: `.agents/skills/pixverse-growth-studio-api/references/pdp-workflow.md`
- Modify: `.agents/skills/pixverse-growth-studio-api/SKILL.md`
- Modify: `.agents/skills/pixverse-api/SKILL.md`
- Create: `test/growth-studio-skill.test.js`
- Modify: `package.json`
- Create: `docs/api/growth-studio-pdp.md`
- Modify: `README.md`
- Modify: `docs/api/command-reference.md`
- Modify: `docs/api/safety-and-recovery.md`

**Interfaces:**
- Agents discover PDP from the umbrella skill and execute it through the Growth Studio skill.
- The reusable payload contains no real seller, merchant URL, secret, or unstable account value.
- Documentation distinguishes public PDP naming from the private upstream adapter only where implementation detail is necessary.

- [ ] **Step 1: Write failing skill structure and terminology tests**

Create `test/growth-studio-skill.test.js`:

```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.join(ROOT, ".agents/skills/pixverse-growth-studio-api");

test("Growth Studio skill exposes a merchant-neutral PDP workflow", async () => {
  const skill = await fs.readFile(path.join(SKILL_ROOT, "SKILL.md"), "utf8");
  const workflow = await fs.readFile(path.join(SKILL_ROOT, "references/pdp-workflow.md"), "utf8");
  const payload = JSON.parse(await fs.readFile(path.join(SKILL_ROOT, "references/pdp-payload.json"), "utf8"));

  assert.match(skill, /growth-studio pdp create/);
  assert.match(skill, /--dry-run/);
  assert.match(skill, /--confirm-billable/);
  assert.match(skill, /references\/pdp-workflow\.md/);
  assert.match(workflow, /any seller or merchant/i);
  assert.match(workflow, /fashion|apparel/i);
  assert.match(workflow, /explicit approval/i);
  assert.doesNotMatch(`${workflow}\n${JSON.stringify(payload)}`, /revolve|lioness|amazon|shopify/i);
  assert.equal(payload.type, undefined);
  assert.equal(payload.product.source_url, undefined);
  assert.equal(payload.product.images.length >= 1, true);
  assert.equal(payload.video.mode, "pro");
});

test("Growth Studio PDP reference links resolve inside the skill", async () => {
  const skill = await fs.readFile(path.join(SKILL_ROOT, "SKILL.md"), "utf8");
  for (const target of ["references/pdp-payload.json", "references/pdp-workflow.md"]) {
    assert.match(skill, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await fs.access(path.join(SKILL_ROOT, target));
  }
});
```

- [ ] **Step 2: Add the skill test to both package gates and verify RED**

Add `test/growth-studio-skill.test.js` beside `test/platform-skill.test.js` in `test:api` and `test:coverage`.

Run:

```bash
node --test test/growth-studio-skill.test.js
```

Expected: FAIL because PDP references and skill instructions are missing.

- [ ] **Step 3: Create the neutral reusable payload**

Create `.agents/skills/pixverse-growth-studio-api/references/pdp-payload.json` with this valid public input:

```json
{
  "product": {
    "title": "Linen Summer Shirt",
    "description": "Breathable linen with a relaxed fit.",
    "images": [
      { "url": "https://media.pixverse.ai/example/front.webp" },
      { "url": "https://media.pixverse.ai/example/back.webp" }
    ],
    "brand": "Example Brand",
    "price": { "amount": "59.90", "currency": "USD" }
  },
  "video": {
    "mode": "pro",
    "duration": 10,
    "quality": "high",
    "aspect_ratio": "9:16",
    "additional_prompt": "Soft morning light and clean product-focused styling."
  }
}
```

- [ ] **Step 4: Write the agent PDP workflow reference**

In `references/pdp-workflow.md`, specify exact commands and decision rules:

```bash
npm run cli -- growth-studio upload image /absolute/path/front.webp
npm run cli -- growth-studio pdp create --payload /absolute/path/pdp.json --dry-run
npm run cli -- growth-studio wallet balance
npm run cli -- growth-studio pdp create --payload /absolute/path/pdp.json --confirm-billable
npm run cli -- growth-studio pdp resume /absolute/path/jobs/<job-dir>
npm run cli -- growth-studio wallet ledgers --offset 0 --limit 20
```

The reference must state that uploaded PixVerse URLs are required, the workflow works for any seller or merchant, brand/price are record fields rather than generation controls, approval must be obtained immediately before submission, create is never retried, and ledger matching uses `source_type: video` plus the saved string ID.

It must also state that the currently documented PDP type is for fashion/apparel products and must not imply unrelated-category support.

- [ ] **Step 5: Update both agent entry skills**

Add PDP to the Growth Studio skill's description, common commands, safety model, standard workflow, payload references, artifacts, and troubleshooting. Link to the two new references rather than duplicating their full contents.

Update `.agents/skills/pixverse-api/SKILL.md` so requests for PDP/product-detail-page video route to `pixverse-growth-studio-api`. Preserve the Platform/Growth Studio credential boundary.

- [ ] **Step 6: Create the focused PDP API guide and update entry-point documentation**

Create `docs/api/growth-studio-pdp.md` and link it from the README, command reference, safety guide, and Growth Studio skill. Document:

- the canonical PDP create/dry-run/get/poll/resume commands;
- wallet balance and ledger commands;
- the public payload fields and uploaded-image requirement;
- explicit billing confirmation and single-submit behavior;
- new PDP artifacts, including `ledger-source-id.json`;
- reconciliation rules and the possibility of a free generation producing no ledger entry;
- the fact that existing URL-based video generation remains a separate workflow.
- the present fashion/apparel category boundary despite seller/merchant neutrality.

Keep “KA” out of customer-facing headings and examples. One maintainer implementation note may identify the upstream endpoint/type so the adapter can be audited. Do not include the private Feishu source URL.

- [ ] **Step 7: Run skill and documentation-focused tests**

Run:

```bash
node --test test/growth-studio-skill.test.js test/platform-skill.test.js
npm run check
git diff --check
```

Expected: all pass.

- [ ] **Step 8: Commit the agent kit and docs**

```bash
git add .agents/skills/pixverse-api/SKILL.md \
  .agents/skills/pixverse-growth-studio-api/SKILL.md \
  .agents/skills/pixverse-growth-studio-api/references/pdp-payload.json \
  .agents/skills/pixverse-growth-studio-api/references/pdp-workflow.md \
  test/growth-studio-skill.test.js package.json README.md \
  docs/api/growth-studio-pdp.md docs/api/command-reference.md docs/api/safety-and-recovery.md
git commit -m "docs: add PDP agent workflow"
```

---

### Task 6: Run the complete release and review gate

**Files:**
- Modify only files implicated by failures or review findings from Tasks 1–5.

**Interfaces:**
- Produces a release-ready merchant-neutral PDP implementation with no critical or high review findings.

- [ ] **Step 1: Run focused PDP tests under the production-network guard**

```bash
node --import ./scripts/no-paid-network.js --test \
  test/unit/growth-studio-pdp.test.js \
  test/unit/growth-studio-jobs.test.js \
  test/contract/growth-studio-client.contract.test.js \
  test/unit/growth-studio-compatibility.test.js \
  test/integration/growth-studio-cli.test.js \
  test/e2e/growth-studio-namespaced.e2e.test.js \
  test/growth-studio-skill.test.js
```

Expected: PASS with no production host access.

- [ ] **Step 2: Run the full coverage and test suites**

```bash
npm run test:coverage
npm test
```

Expected: all tests pass and every coverage dimension remains at or above 80%.

- [ ] **Step 3: Run syntax, security, dependency, and whitespace gates**

```bash
npm run check
npm run security:scan
npm audit --audit-level=high
git diff --check
```

Expected: all commands exit 0 with no exposed key, high-severity advisory, or whitespace error.

- [ ] **Step 4: Review the full change for correctness and compatibility**

Inspect:

```bash
git status --short
git diff --stat HEAD~4..HEAD
git diff HEAD~4..HEAD -- src test .agents/skills README.md docs/api package.json
```

Verify manually that:

- PDP public input is merchant-neutral and rejects seller-specific/unknown fields;
- the adapter injects the exact wire type and never mutates input;
- there is exactly one create call per job;
- dry-run/missing-confirmation paths cannot load credentials or call the network;
- PDP resume cannot submit;
- existing general Growth Studio commands, aliases, folders, artifacts, and Platform code remain unchanged;
- no key, live response, account balance, job ID, or customer asset entered the diff.

- [ ] **Step 5: Run security and code review agents and fix material findings**

Request one security-focused review of credential isolation, URL validation, billing confirmation, artifact redaction, and retry behavior, plus one correctness review of validation, job recovery, CLI compatibility, and tests. Fix every critical/high finding, add a regression test for each code fix, and repeat Steps 1–3.

- [ ] **Step 6: Commit any review fixes**

If review produced changes:

```bash
git add src test .agents/skills README.md docs/api package.json
git commit -m "fix: close PDP workflow review gaps"
```

If review produced no changes, do not create an empty commit.

- [ ] **Step 7: Record the final local handoff**

Report the final commit IDs, exact test/coverage totals, and the fact that no live billable generation was performed. Do not push unless the user separately requests it.
