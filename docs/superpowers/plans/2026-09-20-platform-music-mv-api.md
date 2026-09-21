# PixVerse Platform Music MV API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio verification and One-Click Music MV generation as fully cataloged, validated, documented, and recoverable PixVerse Platform API operations.

**Architecture:** Add `audio.verify` beside upload operations and `agent.music-mv` beside the existing Platform agents. Keep Music MV-specific normalization in a focused validator that returns a new payload, then reuse the existing Platform client, durable job writer, video-status polling, and recovery path without adding a second transport or job system.

**Tech Stack:** Node.js ESM, built-in `node:test`, existing Platform client/catalog/job modules, Markdown skill references, JSON contract fixtures.

**Spec:** `docs/superpowers/specs/2026-09-20-platform-music-mv-api-design.md`

## Global Constraints

- Preserve the separate `pixverse`, `pixverse-api platform`, and `pixverse-api growth-studio` product and credential boundaries.
- Never make a paid or credential-bearing production request during implementation or verification.
- Retain all Platform resource IDs as strings after normalization.
- Treat a nonzero `{ ErrCode, ErrMsg, Resp }` envelope as failure even when HTTP succeeds.
- Never automatically retry or resubmit a billable Music MV request.
- Preserve deeply frozen caller input; every normalization returns a new object.
- Use the reviewed Feishu revision as the documentation URL for the two new operations until a public Platform documentation page exists.
- Maintain at least 80 percent coverage for lines, branches, functions, and statements.

---

### Task 1: Extend the independent operation inventory and runtime catalog

**Files:**
- Create: `src/platform/operations/audio.js`
- Modify: `src/platform/operations/agents.js`
- Modify: `src/platform/operations.js`
- Modify: `test/unit/platform-operations.test.js`
- Modify: `test/catalog-completeness.test.js`
- Modify: `test/fixtures/platform/official-operation-inventory.json`
- Modify: `test/fixtures/platform/official-success-shapes.json`
- Create: `test/fixtures/platform/audio.verify/request.json`
- Create: `test/fixtures/platform/audio.verify/success.json`
- Create: `test/fixtures/platform/audio.verify/error.json`
- Create: `test/fixtures/platform/agent.music-mv/request.json`
- Create: `test/fixtures/platform/agent.music-mv/success.json`
- Create: `test/fixtures/platform/agent.music-mv/error.json`

**Interfaces:**
- Produces: catalog operations `audio.verify` and `agent.music-mv` resolvable through `getPlatformOperation(id)` and `matchPlatformCommand(segments)`.
- Produces: `AUDIO_OPERATIONS: readonly PlatformOperation[]` with one synchronous non-billable JSON operation.
- Produces: `agent.music-mv` as a billable asynchronous JSON operation with `resultIdPath: "Resp.video_id"`.
- Consumes: the existing catalog object shape in `src/platform/operations.js`.

- [ ] **Step 1: Add the independent inventory and fixture expectations**

Add these two rows to `official-operation-inventory.json` in workflow order and add matching success shapes:

```json
{
  "id": "audio.verify",
  "command": ["audio", "verify"],
  "method": "POST",
  "path": "/openapi/v2/audio/verification",
  "bodyMode": "json",
  "validationPolicy": "audio.verify",
  "billing": "non-billable",
  "asynchronous": false,
  "resultIdPath": null,
  "documentationUrl": "https://aisphere.feishu.cn/wiki/L8pgwGoSwiDbQ8ksGIHcppcvnrc"
}
```

```json
{
  "id": "agent.music-mv",
  "command": ["agent", "music-mv"],
  "method": "POST",
  "path": "/openapi/v2/video/music_mv_agent/generate",
  "bodyMode": "json",
  "validationPolicy": "agent.music-mv",
  "billing": "billable",
  "asynchronous": true,
  "resultIdPath": "Resp.video_id",
  "documentationUrl": "https://aisphere.feishu.cn/wiki/L8pgwGoSwiDbQ8ksGIHcppcvnrc"
}
```

Use synthetic request fixture IDs such as `"405833376854443"` and `"164913710"`; use `"629000000000000023"` as the Music MV success `video_id`. The audio success response is `{ "ErrCode": 0, "ErrMsg": "Success", "Resp": {} }`. Error fixtures use the established fixture wrapper and documented codes `701020` for unverified audio and `500063` for rejected audio.

- [ ] **Step 2: Change the catalog tests to require 32 operations and real documentation provenance**

Replace the fixed count with:

```js
assert.equal(PLATFORM_OPERATIONS.length, 32);
```

Update the documentation test so legacy operations still require unique `docs.platform.pixverse.ai` URLs, while the two new operation IDs require the exact shared Feishu URL:

```js
const musicMvIds = new Set(["audio.verify", "agent.music-mv"]);
const publicUrls = [];
for (const operation of PLATFORM_OPERATIONS) {
  if (musicMvIds.has(operation.id)) {
    assert.equal(operation.documentationUrl, MUSIC_MV_DOCUMENTATION_URL);
  } else {
    assert.equal(new URL(operation.documentationUrl).hostname, "docs.platform.pixverse.ai");
    publicUrls.push(operation.documentationUrl);
  }
}
assert.equal(new Set(publicUrls).size, publicUrls.length);
```

Apply the same host/provenance rule to the per-operation URL assertion in `test/catalog-completeness.test.js`; do not weaken URL checks for the existing 30 entries.

- [ ] **Step 3: Run the catalog tests to verify RED**

Run:

```bash
node --test test/unit/platform-operations.test.js test/catalog-completeness.test.js
```

Expected: FAIL because the runtime catalog lacks `audio.verify` and `agent.music-mv`.

- [ ] **Step 4: Implement the two operation definitions**

Create `src/platform/operations/audio.js`:

```js
export const AUDIO_OPERATIONS = Object.freeze([Object.freeze({
  id: "audio.verify",
  command: Object.freeze(["audio", "verify"]),
  method: "POST",
  path: "/openapi/v2/audio/verification",
  bodyMode: "json",
  validationPolicy: "audio.verify",
  billing: "non-billable",
  asynchronous: false,
  resultIdPath: null,
})]);
```

Add the Music MV row in `agents.js` without changing the existing agent path:

```js
{
  id: "agent.music-mv",
  command: ["agent", "music-mv"],
  method: "POST",
  path: "/openapi/v2/video/music_mv_agent/generate",
  bodyMode: "json",
  validationPolicy: "agent.music-mv",
  billing: "billable",
  asynchronous: true,
  resultIdPath: "Resp.video_id",
}
```

Import `AUDIO_OPERATIONS` into `operations.js`, compose it immediately after uploads, and attach the shared Feishu URL to both new IDs in `DOCUMENTATION_URLS`.

- [ ] **Step 5: Run catalog and contract fixture tests to verify GREEN**

Run:

```bash
node --test test/unit/platform-operations.test.js test/catalog-completeness.test.js test/contract/platform-client.contract.test.js test/contract/platform-errors.contract.test.js
```

Expected: PASS with 32 catalog rows and valid request/success/error fixtures.

- [ ] **Step 6: Commit the catalog slice**

```bash
git add src/platform/operations/audio.js src/platform/operations/agents.js src/platform/operations.js test/unit/platform-operations.test.js test/catalog-completeness.test.js test/fixtures/platform
git commit -m "feat: catalog Platform Music MV operations"
```

---

### Task 2: Add immutable audio and Music MV validation

**Files:**
- Create: `src/platform/validators/music-mv.js`
- Modify: `src/platform/validators/specialized.js`
- Modify: `src/platform/validation.js`
- Modify: `test/unit/platform-validation.test.js`

**Interfaces:**
- Produces: `normalizeAndValidateMusicMv(operation, payload): object`, returning a fresh canonical payload.
- Produces: `validateAudioVerification(operation, payload): void` within the specialized router.
- Consumes: `requireFields`, `validationError`, and normalized string identifiers from `validators/common.js`.
- Changes: `validateSpecializedOperation` may return a normalized payload; `normalizeAndValidatePlatformInput` uses that value when present.

- [ ] **Step 1: Add RED-table coverage for both operation IDs**

Extend `invalidById`:

```js
"audio.verify": {},
"agent.music-mv": {},
```

Add focused tests for:

```js
const validMusicMv = Object.freeze({
  mv_agent_type: "vibe_mv_v3_custom",
  audio_media_id: "405833376854443",
  image_references: Object.freeze([{ img_id: "164913710", ref_name: "Character Image" }]),
  music_style: "Pop",
  mv_style: "Custom",
  aspect_ratio: "16:9",
  quality: "720p",
  caption_switch: true,
  lip_sync_switch: false,
  instrumental_switch: false,
  seed: 42,
});
```

Assertions must prove:

- the source object remains deeply unchanged;
- `image_references` is removed from the returned payload;
- one new `img_references` array is returned;
- both aliases together fail;
- both documented agent types pass and an unknown value fails;
- IDs must be positive decimal strings after global safe-integer normalization;
- required quality/aspect fields and their enums are enforced;
- music and MV styles match case-insensitively without rewriting caller casing;
- reference arrays contain at most one object with valid `img_id` and optional string `ref_name`;
- custom style requires at least one character or style reference;
- switches are booleans and seed is a non-negative safe integer;
- lyrics under 5,000 characters pass and longer text fails;
- timestamp words are finite, ordered, non-overlapping, non-empty, and within count/text limits.

- [ ] **Step 2: Run focused validation tests to verify RED**

Run:

```bash
node --test test/unit/platform-validation.test.js
```

Expected: FAIL because both validation policies are unhandled.

- [ ] **Step 3: Implement the focused immutable Music MV validator**

Create `music-mv.js` with these exported and private boundaries:

```js
export function normalizeAndValidateMusicMv(operation, payload) {
  const normalized = normalizeImageReferenceAlias(operation, payload);
  requireFields(operation, normalized, [
    "mv_agent_type", "audio_media_id", "aspect_ratio", "quality",
  ]);
  validateAgentType(operation, normalized.mv_agent_type);
  validatePositiveDecimalId(operation, "audio_media_id", normalized.audio_media_id);
  validateEnum(operation, "aspect_ratio", normalized.aspect_ratio, ASPECT_RATIOS);
  validateEnum(operation, "quality", normalized.quality, QUALITIES);
  validateOptionalStyles(operation, normalized);
  validateReferences(operation, normalized);
  validateOptionalScalars(operation, normalized);
  validateLyrics(operation, normalized);
  return normalized;
}
```

Implement alias normalization without mutating the supplied object:

```js
function normalizeImageReferenceAlias(operation, payload) {
  if (payload.img_references !== undefined && payload.image_references !== undefined) {
    throw validationError(operation, "Provide only one of img_references or image_references.");
  }
  if (payload.image_references === undefined) return { ...payload };
  const { image_references, ...rest } = payload;
  return { ...rest, img_references: image_references };
}
```

Use normalized lowercase values only for membership checks. Return the original field values unchanged. Validate lyric timestamps in one forward pass while tracking `previousEnd` and concatenated character count.

- [ ] **Step 4: Route normalization results through the existing validation pipeline**

In `specialized.js`, add:

```js
case "audio.verify":
  requireFields(operation, payload, ["audio_media_id"]);
  validatePositiveDecimalId(operation, "audio_media_id", payload.audio_media_id);
  return;
case "agent.music-mv":
  return normalizeAndValidateMusicMv(operation, payload);
```

In `validation.js`, preserve existing validators while accepting a replacement payload:

```js
const specializedPayload = await validateSpecializedOperation(operation, payload, query, context);
normalizedPayload = specializedPayload ?? payload;
```

- [ ] **Step 5: Run validation and immutability tests to verify GREEN**

Run:

```bash
node --test test/unit/platform-validation.test.js test/catalog-completeness.test.js
```

Expected: PASS, including deeply frozen alias input.

- [ ] **Step 6: Commit the validation slice**

```bash
git add src/platform/validators/music-mv.js src/platform/validators/specialized.js src/platform/validation.js test/unit/platform-validation.test.js
git commit -m "feat: validate Platform Music MV requests"
```

---

### Task 3: Verify CLI transport, durable jobs, and recovery

**Files:**
- Modify: `test/integration/platform-cli.test.js`
- Modify: `test/unit/platform-jobs.test.js`
- Modify: `test/e2e/platform-generation.e2e.test.js`
- Modify: `test/e2e/platform-recovery.e2e.test.js`

**Interfaces:**
- Consumes: catalog-driven `runPlatformCommand`, `submitPlatformJob`, and `resumePlatformJob` without production code changes unless a failing test exposes a real gap.
- Verifies: `audio.verify` sends one synchronous POST; `agent.music-mv` writes a durable request before one billable POST and polls `video.status` with the returned string ID.

- [ ] **Step 1: Add a loopback CLI test for synchronous audio verification**

Use `createMockApiServer` to assert:

```js
assert.equal(request.method, "POST");
assert.equal(request.url, "/openapi/v2/audio/verification");
assert.deepEqual(JSON.parse(request.body), { audio_media_id: "405833376854443" });
```

Return an `ErrCode: 0` envelope and assert `result.operation === "audio.verify"`, one request, a generated trace, and no job directory.

- [ ] **Step 2: Add a dry-run CLI test for alias normalization**

Invoke:

```js
await runPlatformCommand(["agent", "music-mv", "--payload", payloadPath, "--dry-run"], {
  env: {},
  fetchImpl: async () => assert.fail("dry-run must not fetch"),
});
```

Assert the normalized request path, billable classification, absence of `image_references`, presence of one `img_references` entry, and zero filesystem artifacts beyond the input file.

- [ ] **Step 3: Add a Music MV durable-job test**

Call `submitPlatformJob` with `agent.music-mv`. The fake client returns a create envelope with `video_id: "629000000000000023"`, then processing and succeeded status envelopes. Assert:

```js
assert.deepEqual(calls.map(([id]) => id), [
  "agent.music-mv", "video.status", "video.status",
]);
assert.deepEqual(calls[1][1], { video_id: "629000000000000023" });
assert.deepEqual(artifacts["video-id.json"], { video_id: "629000000000000023" });
```

Also assert the saved `request.json` contains only redacted headers and the canonical `img_references` field.

- [ ] **Step 4: Add an ambiguous Music MV recovery test**

Model a connection close after the Music MV POST. Assert one create attempt, a saved request/error artifact, no known ID, and `resumePlatformJob` returning `reconciliation_required` without calling the client. Do not add retry logic.

- [ ] **Step 5: Run integration and E2E tests to verify GREEN**

Run:

```bash
node --import ./scripts/no-paid-network.js --test \
  test/integration/platform-cli.test.js \
  test/unit/platform-jobs.test.js \
  test/e2e/platform-generation.e2e.test.js \
  test/e2e/platform-recovery.e2e.test.js
```

Expected: PASS with all requests confined to loopback or injected clients.

- [ ] **Step 6: Commit the workflow verification slice**

```bash
git add test/integration/platform-cli.test.js test/unit/platform-jobs.test.js test/e2e/platform-generation.e2e.test.js test/e2e/platform-recovery.e2e.test.js
git commit -m "test: cover Platform Music MV recovery"
```

---

### Task 4: Upgrade the Platform API skill and public documentation

**Files:**
- Modify: `test/platform-skill.test.js`
- Modify: `.agents/skills/pixverse-platform-api/SKILL.md`
- Modify: `.agents/skills/pixverse-platform-api/references/capabilities.md`
- Modify: `.agents/skills/pixverse-platform-api/references/operation-catalog.md`
- Modify: `.agents/skills/pixverse-platform-api/references/payload-examples.json`
- Modify: `.agents/skills/pixverse-platform-api/references/models-pricing-and-limits.md`
- Modify: `.agents/skills/pixverse-platform-api/references/workflows-and-recovery.md`
- Modify: `.agents/skills/pixverse-platform-api/references/troubleshooting.md`
- Modify: `docs/api/command-reference.md`
- Modify: `docs/api/platform-operations.md`
- Modify if matched by the count scan: `README.md`

**Interfaces:**
- Produces: discoverable operation markers `operation:audio.verify` and `operation:agent.music-mv`.
- Produces: safe synthetic recipes accepted by the same local validators as CLI input.
- Produces: the prerequisite chain `upload media -> audio verify -> optional image upload -> dry-run -> run-job -> video status/resume`.

- [ ] **Step 1: Add failing skill assertions for the Music MV workflow**

Extend the skill tests to require:

```js
assert.match(capabilities, /audio\.verify/);
assert.match(capabilities, /agent\.music-mv/);
assert.match(workflow, /audio verify/i);
assert.match(workflow, /agent\.music-mv/);
assert.match(pricing, /15 credits.*second/i);
assert.match(pricing, /22\.5 credits.*second/i);
assert.match(pricing, /10.*360 seconds/i);
assert.match(troubleshooting, /701020/);
assert.match(troubleshooting, /500044/);
assert.match(troubleshooting, /400080/);
```

Update the documentation provenance assertion so the two Music MV operations may use the exact Feishu URL while all older rows remain on `docs.platform.pixverse.ai`.

- [ ] **Step 2: Run skill tests to verify RED**

Run:

```bash
node --test test/platform-skill.test.js test/catalog-completeness.test.js
```

Expected: FAIL because the skill lacks the two operations and workflow guidance.

- [ ] **Step 3: Add the operation markers, capability routing, and recipes**

Add to `SKILL.md`:

```markdown
- operation:audio.verify
- operation:agent.music-mv
```

Add a Music MV section to `capabilities.md` that routes audio verification separately from the billable generation. Add complete operation-catalog rows matching runtime metadata.

Add safe recipes to `payload-examples.json`:

```json
"audio.verify": {
  "description": "Verify an uploaded audio media ID before Music MV generation.",
  "input": { "audio_media_id": "405833376854443" }
},
"agent.music-mv": {
  "description": "Create a 720p custom-style Music MV from verified audio and one synthetic image reference.",
  "input": {
    "mv_agent_type": "vibe_mv_v3_custom",
    "audio_media_id": "405833376854443",
    "img_references": [{ "img_id": "164913710", "ref_name": "Character Image" }],
    "music_style": "Pop",
    "mv_style": "Custom",
    "aspect_ratio": "16:9",
    "quality": "720p",
    "caption_switch": true,
    "lip_sync_switch": false,
    "seed": 42
  }
}
```

- [ ] **Step 4: Document pricing, constraints, errors, and recovery**

Record a dated 2026-09-20 source snapshot with 15 credits/second at 720p, the 1.5x 1080p multiplier, 10–360 second duration, 15 MB audio maximum, five aspect ratios, provider concurrency 10, and fifteen built-in styles plus Custom. State that these are refreshable provider facts, not local authorization or billing guarantees.

Add troubleshooting rows for `701020`, `500063`, `500044`, `400080`, and instrumental lip-sync rejection. The remedy for `701020` is verification and a new user-authorized submission—not an automatic verification-and-retry chain.

- [ ] **Step 5: Update human-facing API documentation and capability counts**

Document both commands in `command-reference.md`, add `audio.verify` and `agent.music-mv` to `platform-operations.md`, and run:

```bash
rg -n "30 specialized|30 operations|30-operation|agent real-estate|agent\.real-estate" README.md docs .agents/skills
```

Update only statements that describe the runtime catalog. Leave historical design records unchanged unless they claim to describe the current version.

- [ ] **Step 6: Validate the skill and docs to verify GREEN**

Run:

```bash
node --test test/platform-skill.test.js test/catalog-completeness.test.js
python3 /Users/john/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pixverse-platform-api
npm run check
```

Expected: PASS with 32 recipes, 32 catalog rows, resolvable local links, and no scaffold placeholders.

- [ ] **Step 7: Commit the documentation and skill slice**

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api docs/api README.md
git commit -m "docs: add Platform Music MV workflow"
```

Omit `README.md` from `git add` if the count scan required no change.

---

### Task 5: Run full verification and independent reviews

**Files:**
- Modify only when a test or reviewer identifies a concrete defect in files already owned by Tasks 1–4.

**Interfaces:**
- Verifies: all repository gates, secret safety, no-paid-network enforcement, correct catalog/skill alignment, and no regression to Growth Studio or web CLI behavior.

- [ ] **Step 1: Run the guarded coverage and API suites**

```bash
npm run test:coverage
npm run test:api
```

Expected: all tests pass with at least 80 percent line, branch, function, and statement coverage.

- [ ] **Step 2: Run the remaining repository checks**

```bash
npm test
npm run check
GIT_DIR=.git GIT_WORK_TREE=. npm run security:scan
npm audit --audit-level=high
git --git-dir=.git --work-tree=. diff --check
```

Expected: PASS. If the broad pitch suite discovers unrelated untracked work, isolate and report it rather than modifying or deleting user files.

- [ ] **Step 3: Run independent correctness and security reviews**

Give reviewers the spec, plan, and final diff. Correctness review must check schema ambiguity handling, immutability, result-ID precision, catalog consistency, and recovery behavior. Security review must check secrets, URL/ID validation, network guards, error leakage, and absence of paid live calls.

- [ ] **Step 4: Address only demonstrated findings test-first**

For every accepted finding, add or tighten the smallest failing test, confirm RED, make the focused correction, and rerun the affected suite to GREEN. Do not add speculative abstractions or unrelated refactors.

- [ ] **Step 5: Record the final repository state**

```bash
git --git-dir=.git --work-tree=. status --short --branch
git --git-dir=.git --work-tree=. log --oneline -8
```

Expected: only the user's pre-existing unrelated untracked files remain outside the committed Music MV implementation. Do not push until the user explicitly requests it.
