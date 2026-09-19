# Unified PixVerse API CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `pixverse-api-kit` into one `pixverse-api` CLI with peer `platform` and `growth-studio` namespaces, complete current Platform API coverage, durable recovery, and separate agent skills.

**Architecture:** A thin top-level router delegates to isolated provider modules. Provider-neutral safety primitives handle redaction, lossless JSON, retry classification, polling, and atomic artifacts; Platform and Growth Studio retain separate authentication, validation, envelopes, statuses, and billing behavior.

**Tech Stack:** Node.js 20+ ESM, built-in `node:test`, Fetch/FormData, `json-bigint@1.0.0` for lossless unsafe integers, `c8@10.1.3` for coverage, FFprobe invoked with `execFile` for media inspection.

**Spec:** `docs/superpowers/specs/2026-09-18-platform-and-growth-studio-api-cli-design.md`

## Global Constraints

- `pixverse` remains a separate web CLI; this repository installs only `pixverse-api`.
- Canonical commands are `pixverse-api platform ...` and `pixverse-api growth-studio ...`.
- Platform and Growth Studio credentials never fall back to each other.
- Every new Platform HTTP request gets a fresh UUID `Ai-trace-id`; only explicit recovery may reuse a saved submission trace.
- IDs remain strings in application state and artifacts, including IDs received as unsafe JSON numbers.
- Billable, upload, and destructive requests are submitted at most once automatically.
- All payload transformations return new objects and never mutate caller input.
- Default automated tests use loopback servers and never issue paid or production requests.
- Line, branch, function, and statement coverage for `src/**/*.js` must be at least 80%.
- Compatibility aliases remain through all `0.x` releases and may be removed only in `1.0.0` or later.
- Do not modify `deploy/`, `assets/`, `pilot/`, `projects/`, `research/`, `tmp/`, `payloads/`, or `pixverse-cli-jobs/`.
- Baseline on this clean worktree is 79 passing tests and two unrelated missing-media failures; do not weaken those tests. Restore their ignored assets before claiming the full release suite is green.

---

## File Structure

```text
src/
  cli.js
  cli/{options,output,router}.js
  core/{artifacts,errors,http,media,polling,redaction,trace}.js
  growth-studio/{cli,client,config,folders,jobs,validation}.js
  platform/{cli,client,config,envelope,jobs,operations,request,status,validation,webhooks}.js
  platform/operations/{account,agents,resources,uploads,video-editing,video-generation}.js
  platform/validators/{common,media,specialized,video}.js
  client.js, config.js, folders.js, http.js, jobs.js
test/
  helpers/{cli-process,fixture,mock-api-server,recording-fetch,temp-job-dir}.js
  fixtures/platform/<operation-id>/{request,success,error}.json
  unit/*.test.js
  contract/*.test.js
  integration/*.test.js
  e2e/*.test.js
  catalog-completeness.test.js
  no-paid-network.test.js
.agents/skills/{pixverse-api,pixverse-platform-api,pixverse-growth-studio-api}/
docs/api/{command-reference,platform-operations,safety-and-recovery}.md
scripts/{check-syntax,scan-secrets}.js
```

The flat `src/client.js`, `src/config.js`, `src/folders.js`, `src/http.js`, and `src/jobs.js` become compatibility re-exports after Growth Studio code moves.

---

### Task 1: Provider-neutral safety primitives

**Files:**
- Create: `src/core/errors.js`
- Create: `src/core/redaction.js`
- Create: `src/core/trace.js`
- Create: `src/core/http.js`
- Create: `src/core/polling.js`
- Create: `src/core/artifacts.js`
- Create: `src/core/media.js`
- Create: `test/unit/core-errors.test.js`
- Create: `test/unit/core-redaction.test.js`
- Create: `test/unit/core-trace.test.js`
- Create: `test/unit/core-http.test.js`
- Create: `test/unit/core-polling.test.js`
- Create: `test/unit/core-artifacts.test.js`
- Create: `test/unit/core-media.test.js`
- Modify: `package.json`
- Create: `package-lock.json`

**Interfaces:**
- Produces: `PixverseCliError`, `serializeError(error)`, `redact(value)`, `redactHeaders(headers)`, `createTraceId()`, `requestHttp(options)`, `pollUntilTerminal(options)`, artifact helpers, and `inspectLocalMedia(filePath, options)`.
- Consumes: Node Fetch APIs, filesystem promises, `crypto.randomUUID`, `child_process.execFile`, and lossless JSON parsing.

- [ ] **Step 1: Pin dependencies and write failing redaction/error/trace tests**

Add exact dependencies with `npm install --save-exact json-bigint@1.0.0` and `npm install --save-dev --save-exact c8@10.1.3`. Tests must assert recursive case-insensitive redaction of `authorization`, `api-key`, `api_key`, `token`, and `secret`; immutable inputs; stable serialized error fields; distinct UUIDs; and no secret in JSON output.

```js
const frozen = Object.freeze({ headers: Object.freeze({ "API-KEY": "secret" }), id: "42" });
assert.deepEqual(redact(frozen), { headers: { "API-KEY": "[REDACTED]" }, id: "42" });
assert.match(createTraceId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
```

- [ ] **Step 2: Run the first RED tests**

Run: `node --test test/unit/core-errors.test.js test/unit/core-redaction.test.js test/unit/core-trace.test.js`

Expected: FAIL because the core modules do not exist.

- [ ] **Step 3: Implement immutable errors, redaction, and trace creation**

`PixverseCliError` accepts `{ category, provider, operation, status, code, retryable, retryAfter, traceId, details, cause }`. `serializeError` returns snake-case public fields and applies `redact`. `createTraceId` returns `randomUUID()`.

- [ ] **Step 4: Write failing HTTP, polling, artifact, and media tests**

Cover lossless parsing of `{"video_id":627410861853514292}`, numeric and date `Retry-After`, retry of GET-only 429/5xx/transport failures, no POST retry, injected clock/sleep polling, unknown status preservation, timeout, exclusive job directories, atomic no-overwrite writes, append-only JSONL, traversal/symlink rejection, and `execFile` argument safety.

```js
assert.equal(result.body.video_id, "627410861853514292");
assert.equal(postAttempts, 1);
await assert.rejects(writeJsonArtifact(file, { second: true }), /already exists/);
assert.deepEqual(execCalls[0].args, ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,width,height", "-of", "json", mediaPath]);
```

- [ ] **Step 5: Run the second RED tests**

Run: `node --test test/unit/core-http.test.js test/unit/core-polling.test.js test/unit/core-artifacts.test.js test/unit/core-media.test.js`

Expected: FAIL because the remaining core modules do not exist.

- [ ] **Step 6: Implement the minimal safe core**

Configure `json-bigint` with `{ storeAsString: true, protoAction: "error", constructorAction: "error" }`. `requestHttp` retries only `GET`/`HEAD` under an explicit bounded policy. Artifact writes use a same-directory temporary file opened with `wx`, then rename. `inspectLocalMedia` calls FFprobe with `execFile`, never a shell.

- [ ] **Step 7: Verify Task 1 and commit**

Run: `node --test test/unit/core-*.test.js && npm run check`

Commit: `feat: add provider-neutral API safety primitives`

---

### Task 2: Isolate Growth Studio modules without behavior changes

**Files:**
- Create: `src/growth-studio/config.js`
- Create: `src/growth-studio/validation.js`
- Create: `src/growth-studio/client.js`
- Create: `src/growth-studio/folders.js`
- Create: `src/growth-studio/jobs.js`
- Create: `src/growth-studio/cli.js`
- Modify: `src/client.js`
- Modify: `src/config.js`
- Modify: `src/folders.js`
- Modify: `src/http.js`
- Modify: `src/jobs.js`
- Create: `test/unit/growth-studio-compatibility.test.js`

**Interfaces:**
- Produces: `getGrowthStudioConfig(env)`, `GrowthStudioClient`, `runGrowthStudioCommand(args, context)`, `getGrowthStudioHelp()`, and `runGrowthStudioJob(client, payload, options)`.
- Preserves: all current named exports from flat modules through re-exports.

- [ ] **Step 1: Write characterization tests before moving code**

Assert bearer auth, folder-key override, numeric-string IDs, immutable folder injection, current JSON result shapes, polling behavior, artifact names, and these canonical command mappings:

```js
const mappings = {
  "avatars": ["avatars", "list"],
  "folders": ["folders", "list"],
  "ensure-folder": ["folders", "ensure"],
  "upload-image": ["upload", "image"],
  "create-from-url": ["video", "create-from-url"],
  "create-from-json": ["video", "create-from-json"],
  "get": ["video", "get"],
  "poll": ["video", "poll"],
  "list": ["video", "list"],
  "edit": ["video", "edit"],
  "run-job": ["run-job"]
};
```

- [ ] **Step 2: Run RED characterization tests**

Run: `node --test test/client.test.js test/folders.test.js test/jobs.test.js test/unit/growth-studio-compatibility.test.js`

Expected: existing tests PASS; new namespaced-interface assertions FAIL.

- [ ] **Step 3: Move implementation and add compatibility re-exports**

Move code without changing request paths or envelopes. `video status` delegates to one read-only `getVideo`; `video poll` retains bounded polling. Flat modules contain only `export * from "./growth-studio/<module>.js"` where applicable.

- [ ] **Step 4: Verify Task 2 and commit**

Run: `node --test test/client.test.js test/folders.test.js test/jobs.test.js test/unit/growth-studio-compatibility.test.js`

Commit: `refactor: isolate Growth Studio provider modules`

---

### Task 3: Add the provider-first CLI router and legacy aliases

**Files:**
- Create: `src/cli/options.js`
- Create: `src/cli/output.js`
- Create: `src/cli/router.js`
- Rewrite: `src/cli.js`
- Create: `test/integration/cli-routing.test.js`
- Create: `test/helpers/cli-process.js`

**Interfaces:**
- Produces: `routeCommand(argv)`, `formatSuccess(value)`, `formatError(error)`, and `main(argv, context) -> Promise<number>`.
- Consumes: `runGrowthStudioCommand` now; `runPlatformCommand` after Task 7.

- [ ] **Step 1: Write failing routing and process-isolation tests**

Assert top-level help, `growth-studio` routing, unknown-provider exit code, lazy provider configuration, one deprecation line on stderr, unchanged legacy JSON stdout, and no direct `process.exit` from imported functions.

```js
assert.deepEqual(routeCommand(["growth-studio", "folders", "list"]), {
  provider: "growth-studio", providerArgs: ["folders", "list"], legacy: false
});
assert.equal(JSON.parse(stdout).video_id, "627410861853514292");
assert.match(stderr, /deprecated.*growth-studio/i);
```

- [ ] **Step 2: Run RED router tests**

Run: `node --test test/integration/cli-routing.test.js`

Expected: FAIL because the router does not exist.

- [ ] **Step 3: Implement the import-safe router**

`src/cli.js` calls `main(process.argv.slice(2), defaultContext)` only when executed directly. All command functions receive `{ env, fetchImpl, stdout, stderr, cwd, sleep, now }`. Platform routing may return a setup message until Task 7, but must not load Growth Studio config.

- [ ] **Step 4: Verify Task 3 and commit**

Run: `node --test test/integration/cli-routing.test.js test/unit/growth-studio-compatibility.test.js`

Commit: `feat: add provider-first PixVerse API routing`

---

### Task 4: Define Platform configuration, envelopes, statuses, and the complete operation catalog

**Files:**
- Create: `src/platform/config.js`
- Create: `src/platform/envelope.js`
- Create: `src/platform/status.js`
- Create: `src/platform/operations.js`
- Create: `src/platform/operations/account.js`
- Create: `src/platform/operations/uploads.js`
- Create: `src/platform/operations/resources.js`
- Create: `src/platform/operations/video-generation.js`
- Create: `src/platform/operations/video-editing.js`
- Create: `src/platform/operations/agents.js`
- Create: `test/fixtures/platform/official-operation-inventory.json`
- Create: `test/unit/platform-config.test.js`
- Create: `test/unit/platform-envelope.test.js`
- Create: `test/unit/platform-status.test.js`
- Create: `test/unit/platform-operations.test.js`

**Interfaces:**
- Produces: `getPlatformConfig(env, options)`, `parsePlatformEnvelope(body, context)`, `normalizePlatformStatus(rawStatus)`, `PLATFORM_OPERATIONS`, `getPlatformOperation(id)`, and `matchPlatformCommand(segments)`.

- [ ] **Step 1: Create an independent official inventory fixture**

Record this verified matrix in JSON; it must not import implementation code:

```text
account.balance GET /openapi/v2/account/balance
account.usage POST /openapi/v2/account/billing/usage-detail
upload.image POST /openapi/v2/image/upload multipart
upload.media POST /openapi/v2/media/upload multipart
resource.templates GET /openapi/v2/video/effects/templates/list
resource.tts-speakers GET /openapi/v2/video/tts_speaker
resource.restyle-effects GET /openapi/v2/video/restyle/list
voice.create POST /openapi/v2/video/tts_speaker json
voice.delete DELETE /openapi/v2/video/tts_speaker/{speaker_id}
image.template POST /openapi/v2/image/template/generate
image.status GET /openapi/v2/image/result/{image_id}
video.text POST /openapi/v2/video/text/generate
video.image POST /openapi/v2/video/img/generate
video.template POST /openapi/v2/video/img/generate
video.transition POST /openapi/v2/video/transition/generate
video.multi-transition POST /openapi/v2/video/multi_transition/generate
video.lip-sync POST /openapi/v2/video/lip_sync/generate
video.fusion POST /openapi/v2/video/fusion/generate
video.restyle POST /openapi/v2/video/restyle/generate
video.swap-mask POST /openapi/v2/video/mask/selection
video.swap POST /openapi/v2/video/swap/generate
video.sound-effect POST /openapi/v2/video/sound_effect/generate
video.extend POST /openapi/v2/video/extend/generate
video.motion-control POST /openapi/v2/video/mimic/generate
video.modify POST /openapi/v2/video/modify/generate
video.upscale POST /openapi/v2/video/upscale/generate
video.avatar POST /openapi/v2/video/avatar/generate
agent.viral-recreation POST /openapi/v2/video/agent/generate
agent.real-estate POST /openapi/v2/video/agent/generate
video.status GET /openapi/v2/video/result/{video_id}
```

Each fixture entry also includes its official `https://docs.platform.pixverse.ai/...` page URL, body mode, CLI segments, validation policy, billing class, and async policy.

- [ ] **Step 2: Write failing config, envelope, status, and catalog tests**

Assert Platform-only environment lookup, default base URL, `ErrCode=0` unwrapping, nonzero envelope failure on HTTP 200, raw-envelope retention, exact status mappings `1/5/6/7/8`, unknown status retention, catalog uniqueness, and one implementation entry per inventory entry.

- [ ] **Step 3: Run RED Platform primitive tests**

Run: `node --test test/unit/platform-config.test.js test/unit/platform-envelope.test.js test/unit/platform-status.test.js test/unit/platform-operations.test.js`

Expected: FAIL because Platform modules do not exist.

- [ ] **Step 4: Implement frozen catalog and Platform primitives**

Each operation is frozen and contains `{ id, command, method, path, bodyMode, validationPolicy, billing, asynchronous, resultIdPath, documentationUrl }`. Billable classification is explicit, never inferred from HTTP method.

- [ ] **Step 5: Verify Task 4 and commit**

Run: `node --test test/unit/platform-*.test.js`

Commit: `feat: define the Platform API operation catalog`

---

### Task 5: Validate every Platform input without mutation

**Files:**
- Create: `src/platform/validation.js`
- Create: `src/platform/validators/common.js`
- Create: `src/platform/validators/media.js`
- Create: `src/platform/validators/video.js`
- Create: `src/platform/validators/specialized.js`
- Create: `test/unit/platform-validation.test.js`
- Create: `test/fixtures/media/tiny.png`
- Create: `test/fixtures/media/tiny.mp4`
- Create: `test/fixtures/media/tiny.wav`

**Interfaces:**
- Produces: `normalizeAndValidatePlatformInput(operation, input, context) -> { payload, query, pathParams, files, validationSummary }`.
- Consumes: operation validation policy and `inspectLocalMedia`.

- [ ] **Step 1: Write named table-driven RED tests for all 30 operation IDs**

Test required fields and identifier combinations, string IDs, safe URLs, prompt length, model/quality/duration/aspect ratio/seed boundaries, transition frames, multi-transition order, fusion references, voice/lip-sync fields, swap mask/source inputs, source video requirements, agent inputs, media format/size/dimension/duration, unknown field preservation, and deep-frozen input immutability.

```js
for (const operationId of inventory.map(({ id }) => id)) {
  test(`${operationId} rejects its minimal invalid input before fetch`, async () => {
    await assert.rejects(() => normalizeAndValidatePlatformInput(operation, invalidById[operationId], context));
    assert.equal(context.fetchCalls.length, 0);
  });
}
```

- [ ] **Step 2: Run RED validation tests**

Run: `node --test test/unit/platform-validation.test.js`

Expected: FAIL because validators do not exist.

- [ ] **Step 3: Implement common and operation-specific validators**

Keep official unknown fields. Reject unsafe integer JavaScript numbers for IDs with a message requiring a string. For file-or-URL uploads require exactly one source. Validate image upload as JPG/JPEG/PNG/WebP, under 20 MB, maximum dimension 10,000 px.

- [ ] **Step 4: Verify Task 5 and commit**

Run: `node --test test/unit/platform-validation.test.js test/unit/core-media.test.js`

Commit: `feat: validate every Platform API operation`

---

### Task 6: Build the Platform request layer and client

**Files:**
- Create: `src/platform/request.js`
- Create: `src/platform/client.js`
- Create: `test/helpers/recording-fetch.js`
- Create: `test/contract/platform-client.contract.test.js`
- Create: `test/contract/platform-errors.contract.test.js`
- Create: `test/fixtures/platform/<operation-id>/request.json`
- Create: `test/fixtures/platform/<operation-id>/success.json`
- Create: `test/fixtures/platform/<operation-id>/error.json`

**Interfaces:**
- Produces: `buildPlatformRequest(operation, normalizedInput)` and `PlatformClient.execute(operationId, input, options)`.
- Consumes: config, catalog, validation, trace, HTTP, and envelope modules.

- [ ] **Step 1: Write contract fixtures and RED tests independent of implementation**

Iterate `official-operation-inventory.json`. For every operation, assert exact method/path, `API-KEY`, fresh `Ai-trace-id`, body serialization, success envelope, error envelope, string IDs, and unchanged caller input. Multipart requests must not set `Content-Type` manually.

- [ ] **Step 2: Run RED contract tests**

Run: `node --test test/contract/platform-client.contract.test.js test/contract/platform-errors.contract.test.js`

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement request building and `PlatformClient`**

```js
const result = await client.execute("video.text", input, {
  traceId: createTraceId(),
  recovery: false,
  signal
});
// result: { operation, traceId, envelope, data, retryAfter }
```

Only explicit `{ recovery: true, traceId: savedTraceId }` accepts a caller trace. New requests ignore no trace implicitly; they generate one. Read-only catalog entries may use bounded retry; all others submit once.

- [ ] **Step 4: Verify Task 6 and commit**

Run: `node --test test/contract/platform-*.contract.test.js`

Commit: `feat: add the Platform API client`

---

### Task 7: Expose all Platform commands, help, dry-run, and raw access

**Files:**
- Create: `src/platform/cli.js`
- Create: `test/integration/platform-cli.test.js`
- Create: `test/helpers/mock-api-server.js`
- Modify: `src/cli/router.js`
- Modify: `src/cli.js`
- Modify: `test/integration/cli-routing.test.js`

**Interfaces:**
- Produces: `runPlatformCommand(args, context)` and `getPlatformHelp()`.
- Consumes: operation catalog, validation, request builder, and client.

- [ ] **Step 1: Write RED CLI integration tests against a loopback server**

Assert discoverable help for all inventory commands, stable JSON stdout, diagnostics on stderr, lazy config, `--payload`, positional upload/status/delete IDs, `--dry-run` with zero requests and no API key, exact multipart bytes, and provider-specific error exits.

- [ ] **Step 2: Write RED security tests for `platform raw`**

Accept only an explicit HTTP method plus a relative normalized `/openapi/v2/` path. Reject absolute URLs, `..`, encoded traversal, CR/LF header injection, caller auth headers, trace reuse, and implicit retry for non-read-only methods.

- [ ] **Step 3: Run RED CLI tests**

Run: `node --test test/integration/platform-cli.test.js test/integration/cli-routing.test.js`

Expected: FAIL because Platform routing is not connected.

- [ ] **Step 4: Implement catalog-driven commands and safe raw access**

`--dry-run` runs every locally possible validator, returns a redacted normalized request, performs no fetch, writes no artifact, and does not require an API key. `raw` is excluded from `PLATFORM_OPERATIONS` and cannot satisfy completeness checks.

- [ ] **Step 5: Verify Task 7 and commit**

Run: `node --test test/integration/platform-cli.test.js test/integration/cli-routing.test.js`

Commit: `feat: expose every Platform API command`

---

### Task 8: Add durable Platform jobs and recovery

**Files:**
- Create: `src/platform/jobs.js`
- Create: `test/unit/platform-jobs.test.js`
- Create: `test/e2e/platform-generation.e2e.test.js`
- Create: `test/e2e/platform-recovery.e2e.test.js`
- Create: `test/helpers/temp-job-dir.js`
- Modify: `src/platform/cli.js`

**Interfaces:**
- Produces: `submitPlatformJob(client, operationId, input, options)` and `resumePlatformJob(client, jobDir, options)`.
- Consumes: core artifacts and polling, Platform client, catalog, and status normalization.

- [ ] **Step 1: Write RED job-order and ambiguity tests**

Assert the exact order: validate → exclusive directory → redacted `request.json` → one submission → `create-response.json` → string ID file → JSONL snapshots → `final.json`. On any failure write safe `error.json`. Simulate server acceptance followed by transport timeout and assert exactly one POST.

- [ ] **Step 2: Write RED offline generation and recovery E2E tests**

Flow one: upload tiny image → `video.image` → processing → success. Flow two: `agent.viral-recreation` accepted with ambiguous response → resume from saved trace/video/job evidence without a second billable POST. Cover deletion, moderation failure, generation failure, unknown status, and polling timeout.

- [ ] **Step 3: Run RED job tests**

Run: `node --test test/unit/platform-jobs.test.js test/e2e/platform-generation.e2e.test.js test/e2e/platform-recovery.e2e.test.js`

Expected: FAIL because the job layer does not exist.

- [ ] **Step 4: Implement job submission and resume**

Every billable catalog command delegates through `submitPlatformJob`. Resume reads artifacts before network access and may query status or reuse the saved trace only through an explicit recovery action; it never creates a new generation.

- [ ] **Step 5: Verify Task 8 and commit**

Run: `node --test test/unit/platform-jobs.test.js test/e2e/platform-*.e2e.test.js`

Commit: `feat: add durable Platform job recovery`

---

### Task 9: Verify and handle Platform webhooks

**Files:**
- Create: `src/platform/webhooks.js`
- Create: `test/unit/platform-webhooks.test.js`
- Create: `test/e2e/platform-webhook.e2e.test.js`

**Interfaces:**
- Produces: `verifyPlatformWebhook({ rawBody, headers, secret, now, nonceStore })`, `parsePlatformWebhook(rawBody)`, and `createPlatformWebhookHandler({ secret, onDelivery, now, nonceStore })`.

- [ ] **Step 1: Write RED signature and replay tests from the official formula**

The signed string is `${timestamp}\n${nonce}\n${encodeURIComponent(rawBody)}`. The signature is Base64 HMAC-SHA256 with the webhook secret. Test valid signature, altered body, wrong secret, missing header, stale timestamp, repeated nonce, malformed payload, and verification before JSON parsing.

```js
const signed = `${timestamp}\n${nonce}\n${encodeURIComponent(rawBody)}`;
const signature = createHmac("sha256", secret).update(signed).digest("base64");
```

- [ ] **Step 2: Run RED webhook tests**

Run: `node --test test/unit/platform-webhooks.test.js test/e2e/platform-webhook.e2e.test.js`

Expected: FAIL because webhook support does not exist.

- [ ] **Step 3: Implement timing-safe signature verification and handler**

Normalize documented headers `Webhook-Timestamp`, `Webhook-Nonce`, `Webhook-Signature`, and `Ai-Trace-Id`. Use `timingSafeEqual`. Return HTTP 200 with exact plain body `ok` only after verification and successful `onDelivery`; otherwise return a non-200 response and do not mutate artifacts.

- [ ] **Step 4: Verify Task 9 and commit**

Run: `node --test test/unit/platform-webhooks.test.js test/e2e/platform-webhook.e2e.test.js`

Commit: `feat: verify Platform webhook deliveries`

---

### Task 10: Complete provider integration and catalog coverage gates

**Files:**
- Create: `test/e2e/growth-studio-namespaced.e2e.test.js`
- Create: `test/catalog-completeness.test.js`
- Create: `test/no-paid-network.test.js`
- Create: `test/contract/growth-studio-client.contract.test.js`
- Create: `test/integration/growth-studio-cli.test.js`

**Interfaces:**
- Consumes: both provider command surfaces and the independent Platform inventory.
- Produces: offline release-confidence gates.

- [ ] **Step 1: Write RED completeness and no-paid-network tests**

Compare the independent inventory against catalog IDs, command mappings, validators, help output, fixture directories, documentation URLs, and Platform-skill operation markers. Assert all default test URLs resolve to loopback and child environments strip real `PIXVERSE_*_API_KEY` values.

- [ ] **Step 2: Write Growth Studio namespace E2E and contract tests**

Exercise namespaced create → poll, folder resolution, legacy alias delegation, unchanged result JSON, and absence of Platform headers. Missing Platform config must not affect Growth Studio, and missing Growth Studio config must not affect Platform.

- [ ] **Step 3: Run RED integration gates**

Run: `node --test test/catalog-completeness.test.js test/no-paid-network.test.js test/contract/growth-studio-client.contract.test.js test/integration/growth-studio-cli.test.js test/e2e/growth-studio-namespaced.e2e.test.js`

Expected: completeness FAIL until skill markers from Task 11 exist; all implemented provider behavior should otherwise pass. Record the exact missing skill markers rather than weakening the gate.

- [ ] **Step 4: Complete provider integration without bypasses**

Fix only real routing, fixture, validator, and help gaps. Do not add `raw` as a catalog entry and do not skip missing endpoints.

- [ ] **Step 5: Verify behavior excluding the intentional skill-marker RED and commit**

Run: `node --test test/no-paid-network.test.js test/contract test/integration test/e2e`

Commit: `test: cover provider workflows offline`

---

### Task 11: Add router/provider skills and public documentation

**Files:**
- Create: `.agents/skills/pixverse-api/SKILL.md`
- Create: `.agents/skills/pixverse-platform-api/SKILL.md`
- Create: `.agents/skills/pixverse-platform-api/references/operation-catalog.md`
- Create: `.agents/skills/pixverse-platform-api/references/payload-examples.json`
- Modify: `.agents/skills/pixverse-growth-studio-api/SKILL.md`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/api/command-reference.md`
- Create: `docs/api/platform-operations.md`
- Create: `docs/api/safety-and-recovery.md`
- Modify: `package.json`

**Interfaces:**
- Produces: user and agent documentation for every catalog operation.
- Consumes: final command help, catalog, validators, job artifacts, and compatibility policy.

- [ ] **Step 1: Run the intentional RED completeness test**

Run: `node --test test/catalog-completeness.test.js`

Expected: FAIL listing missing Platform-skill operation markers.

- [ ] **Step 2: Write the router and Platform skills**

Document setup, separate credit pools, every canonical command, every operation ID, uploads, dry-run, artifacts, resume, ambiguous-request handling, raw restrictions, webhook verification, and FFprobe. Include sanitized payload examples only.

- [ ] **Step 3: Update Growth Studio skill and project docs**

Use namespaced commands as canonical. Retain one legacy alias table. Update package description to cover both APIs and bump version to `0.2.0`.

- [ ] **Step 4: Verify docs/catalog parity and commit**

Run: `node --test test/catalog-completeness.test.js && npm run check`

Commit: `docs: document the unified PixVerse API CLI`

---

### Task 12: Enforce coverage, syntax, secret scanning, and final reviews

**Files:**
- Create: `scripts/check-syntax.js`
- Create: `scripts/scan-secrets.js`
- Create: `test/unit/release-scripts.test.js`
- Modify: `package.json`
- Modify: tests only when a review identifies a genuine missing assertion.

**Interfaces:**
- Produces scripts `test:api`, `test:coverage`, `check`, and `security:scan`.

- [ ] **Step 1: Write failing tests for release scripts**

Assert the syntax walker covers nested `src/**/*.js` and `test/**/*.js`, the secret scanner rejects representative `mh_live_`, `API-KEY`, bearer token, and private-key fixtures while allowing documented placeholders, and production PixVerse hosts are absent from executable default tests.

- [ ] **Step 2: Implement portable Node release scripts**

Set package scripts to:

```json
{
  "test:api": "node --test test/unit/*.test.js test/contract/*.test.js test/integration/*.test.js test/e2e/*.test.js test/catalog-completeness.test.js test/no-paid-network.test.js",
  "test:coverage": "c8 --check-coverage --lines 80 --branches 80 --functions 80 --statements 80 --include 'src/**/*.js' node --test test/unit/*.test.js test/contract/*.test.js test/integration/*.test.js test/e2e/*.test.js test/catalog-completeness.test.js test/no-paid-network.test.js",
  "check": "node scripts/check-syntax.js",
  "security:scan": "node scripts/scan-secrets.js"
}
```

- [ ] **Step 3: Run the API release gate**

Run:

```bash
npm run check
npm run test:api
npm run test:coverage
npm audit --audit-level=high
npm run security:scan
git diff --check
```

Expected: all commands PASS with at least 80% in every coverage category and zero high-severity audit findings.

- [ ] **Step 4: Restore the two ignored media sets and run the repository-wide suite**

Restore the original, authorized files referenced by `test/revolve-v3-v4-comparison.test.js` and `test/revolve-v4-release.test.js` without committing them. Run `npm test`. Expected: all tests PASS. If the assets cannot be restored, report the two unchanged baseline failures and do not claim the full repository suite is green.

- [ ] **Step 5: Run separate code-quality and security reviews**

The code review must check correctness, maintainability, compatibility, and missing tests. The security review must check credential isolation, lossless IDs, redaction, path/URL validation, raw restrictions, timing-safe webhook verification, replay control, and no retry after ambiguous billable submission. Fix every critical/high finding test-first, then rerun Step 3.

- [ ] **Step 6: Commit the release gates**

Commit: `chore: enforce PixVerse API release gates`

---

## Execution Order and Checkpoints

```text
Task 1 -> Task 2 -> Task 3
Task 1 -> Task 4 -> Task 5 -> Task 6 -> Task 7 -> Task 8 -> Task 9
Task 3 + Task 8 + Task 9 -> Task 10 -> Task 11 -> Task 12
```

Review after every commit. Do not begin the next task while the current task's focused tests are red. Endpoint-family files under `src/platform/operations/` and validator files under `src/platform/validators/` may be assigned to separate workers only after Task 4 locks the schema; each worker must own disjoint files and must not alter the shared aggregator without coordination.
