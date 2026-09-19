# PixVerse Platform API Skill Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the project-local `pixverse-platform-api` skill into a complete, safe, progressively disclosed guide for all 30 specialized Platform operations and webhook workflows.

**Architecture:** Keep `.agents/skills/pixverse-platform-api/SKILL.md` as a compact router and put task selection, exact operation metadata, validated recipes, volatile model facts, operational workflows, and troubleshooting in focused references. Treat `PLATFORM_OPERATIONS`, the independently checked inventory, and local validators as the versioned executable contract; test the skill against them without network access, while linking dynamic claims to official Platform documentation for live refreshes.

**Tech Stack:** Markdown and JSON skill resources, Node.js 20 ESM, built-in `node:test`, existing Platform operation validators, bundled Codex `skill-creator` validator.

**Spec:** `docs/superpowers/specs/2026-09-19-pixverse-platform-api-skill-upgrade-design.md`

## Global Constraints

- Cover exactly the 30 specialized operations in `test/fixtures/platform/official-operation-inventory.json` plus webhook handling; do not add endpoints to the CLI.
- Keep the web `pixverse` CLI, `pixverse-api platform`, and `pixverse-api growth-studio` as distinct products and namespaces.
- Read only `PIXVERSE_PLATFORM_API_KEY` for Platform requests; never fall back to Growth Studio keys or web-session credentials.
- Use `https://app-api.pixverse.ai` unless the user explicitly supplies a scoped base URL override.
- Use a fresh `Ai-trace-id` for each new request; reuse a saved trace only through explicit recovery.
- Preserve every API resource identifier as a string, including numeric-looking values larger than JavaScript's safe integer range.
- Locally validate and run `--dry-run` before a billable call; require current user authorization immediately before live spend unless the active request already authorizes that exact spend.
- Submit a billable request once. After an ambiguous outcome, reconcile or use `resume`; never retry the submission automatically.
- Treat a Platform response as successful only when transport succeeds and `ErrCode` is zero.
- Verify webhook signature and replay protection before parsing or acknowledging a delivery; return plain `ok` only after verified successful handling.
- Reserve `platform raw` for diagnosis or newly documented endpoints absent from the specialized catalog; never allow it to override authentication or trace headers.
- Mark pricing, models, compatibility, rate limits, template lists, TTS speakers, and restyle presets as live facts that require current official-documentation or read-only API verification.
- Never embed the 654-template snapshot as a permanent catalog.
- Automated validation must retain the no-paid-network guard and must not consume credits, use real credentials, or use private media.
- Do not add a helper script; the CLI remains the sole implementation of validation, request construction, submission, polling, and recovery.

## File Structure

| File | Responsibility |
|---|---|
| `.agents/skills/pixverse-platform-api/SKILL.md` | Concise discovery surface, reference router, provider boundary, and mandatory safe execution sequence. |
| `.agents/skills/pixverse-platform-api/agents/openai.yaml` | UI-facing name, description, and default prompt; implicit discovery remains enabled. |
| `.agents/skills/pixverse-platform-api/references/capabilities.md` | Task-oriented operation choice and prerequisite chains. |
| `.agents/skills/pixverse-platform-api/references/operation-catalog.md` | Traceable 30-row versioned catalog with method, path, billing, async, result ID, boundary, and official URL. |
| `.agents/skills/pixverse-platform-api/references/payload-examples.json` | Safe examples and source-choice alternatives validated by the same local validators as CLI input. |
| `.agents/skills/pixverse-platform-api/references/models-pricing-and-limits.md` | Verified-at snapshot of model compatibility, upload boundaries, pricing concepts, and live-refresh policy. |
| `.agents/skills/pixverse-platform-api/references/workflows-and-recovery.md` | Read-only, preflight, durable submission, polling, resume, webhook, and raw-diagnostic workflows. |
| `.agents/skills/pixverse-platform-api/references/troubleshooting.md` | Error/status classification and proportional next actions with no blind billable retry. |
| `test/platform-skill.test.js` | Offline structural, catalog, link, example-validation, identifier, status, and secret-safety contract for the skill. |

---

### Task 1: Establish the skill router, UI metadata, and capability decision guide

**Files:**
- Create: `test/platform-skill.test.js`
- Modify: `.agents/skills/pixverse-platform-api/SKILL.md`
- Create: `.agents/skills/pixverse-platform-api/agents/openai.yaml`
- Create: `.agents/skills/pixverse-platform-api/references/capabilities.md`

**Interfaces:**
- Consumes: `PLATFORM_OPERATIONS: readonly PlatformOperation[]` from `src/platform/operations.js`, where each operation exposes `id`, `command`, `method`, `path`, `billing`, `asynchronous`, `resultIdPath`, and `documentationUrl`.
- Produces: a skill entrypoint that initially links the capability, catalog, and recipe references and retains every literal `operation:<id>` marker; a UI config with implicit invocation enabled; a decision guide that maps user goals to operation IDs and prerequisites. Tasks 3 and 4 add their reference links when those files have real content.

- [ ] **Step 1: Write the failing skill-structure and routing tests**

Create `test/platform-skill.test.js` with shared readers and tests for discoverability, the required resource graph, operation markers, and local-link resolution:

```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PLATFORM_OPERATIONS } from "../src/platform/operations.js";

const ROOT = process.cwd();
const SKILL_ROOT = path.join(ROOT, ".agents/skills/pixverse-platform-api");
const REFERENCES = [
  "capabilities.md",
  "operation-catalog.md",
  "payload-examples.json",
];

async function readSkill(relativePath) {
  return fs.readFile(path.join(SKILL_ROOT, relativePath), "utf8");
}

function localMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)]
    .map((match) => match[1]);
}

test("Platform skill exposes the complete progressively disclosed resource graph", async () => {
  const skill = await readSkill("SKILL.md");
  const ui = await readSkill("agents/openai.yaml");

  assert.match(skill, /name: pixverse-platform-api/);
  assert.match(skill, /pixverse-api platform/);
  assert.match(skill, /not.*web.*pixverse|separate.*web.*pixverse/i);
  assert.match(skill, /not.*growth.?studio|separate.*growth.?studio/i);
  assert.match(ui, /display_name: "PixVerse Platform API"/);
  assert.match(ui, /allow_implicit_invocation: true/);
  assert.match(ui, /\$pixverse-platform-api/);

  for (const reference of REFERENCES) {
    assert.match(skill, new RegExp(`references/${reference.replace(".", "\\.")}`));
  }
  for (const operation of PLATFORM_OPERATIONS) {
    assert.match(skill, new RegExp(`operation:${operation.id.replaceAll(".", "\\.")}`));
  }
});

test("all local Markdown links in the skill resolve inside the skill folder", async () => {
  const markdownFiles = ["SKILL.md", "references/capabilities.md"];
  for (const relativeFile of markdownFiles) {
    const markdown = await readSkill(relativeFile);
    for (const target of localMarkdownLinks(markdown)) {
      const resolved = path.resolve(SKILL_ROOT, path.dirname(relativeFile), target);
      assert.equal(resolved.startsWith(`${SKILL_ROOT}${path.sep}`), true);
      await fs.access(resolved);
    }
  }
});
```

- [ ] **Step 2: Run the focused tests and verify the expected RED state**

Run:

```bash
node --test test/platform-skill.test.js
```

Expected: FAIL because `agents/openai.yaml`, `capabilities.md`, and three other required references do not yet exist, and `SKILL.md` does not route to the complete resource graph.

- [ ] **Step 3: Write the concise router and UI metadata**

Replace the body of `SKILL.md` while preserving its valid frontmatter. Use this routing structure and keep the existing 30 operation markers in a compact final section:

```markdown
# PixVerse Platform API

Use this skill for the server-side Platform API through `pixverse-api platform`. It is separate from the web `pixverse` CLI and from `pixverse-api growth-studio`; credentials, credits, commands, and job artifacts do not cross those boundaries.

## Route the request

- Read [capabilities](references/capabilities.md) to select an operation or build a prerequisite chain from a user goal.
- Read [operation catalog](references/operation-catalog.md) for the exact command, method, path, billing class, async behavior, result ID, and official endpoint page.
- Read [payload examples](references/payload-examples.json) before authoring a payload or query.

## Provider boundary

Use only `PIXVERSE_PLATFORM_API_KEY` and the default `https://app-api.pixverse.ai`. Never use Growth Studio keys, web-session credentials, or another provider's credit balance. Preserve all API IDs as strings.

## Safe execution

1. Resolve prerequisites with read-only catalog/account calls.
2. Validate a specialized command locally and run it with `--dry-run`.
3. For a billable operation, confirm the exact live spend is authorized in the active request immediately before submission.
4. Submit once with a fresh trace ID, preferably through `run-job`; preserve the returned job directory and result ID.
5. Poll the known image/video ID or use `resume`. If submission was ambiguous and no ID was saved, stop at `reconciliation_required`; do not resubmit.
6. Treat success as transport success plus `ErrCode === 0`.

Use `platform raw` only for diagnosis or a newly documented endpoint absent from the specialized catalog. Do not use raw access to bypass specialized validation, authentication, trace, billing, or recovery controls.
```

Create `.agents/skills/pixverse-platform-api/agents/openai.yaml` exactly as:

```yaml
interface:
  display_name: "PixVerse Platform API"
  short_description: "Safely use every PixVerse Platform API capability"
  default_prompt: "Use $pixverse-platform-api to select and safely run the correct PixVerse Platform API workflow."
policy:
  allow_implicit_invocation: true
```

- [ ] **Step 4: Write the task-oriented capability guide**

Create `references/capabilities.md` with these concrete decision groups and prerequisite chains:

```markdown
# Capability Selection

Choose by desired outcome first. Then check the exact operation row and a validated payload example.

## Discover and prepare

| Goal | Operation | Prerequisite/output |
|---|---|---|
| Check credits | `account.balance` | Read-only; use before spend when balance matters. |
| Audit deductions or refunds | `account.usage` | Use UTC range or cursor pagination. |
| Upload a still image | `upload.image` | Produces an image ID string. |
| Upload video or audio | `upload.media` | Produces a media ID string. |
| Find a current effect | `resource.templates` | Query live; do not use a stored template snapshot. |
| Find a speech voice | `resource.tts-speakers` | Query live system/custom speakers. |
| Find a restyle preset | `resource.restyle-effects` | Query live before `video.restyle`. |
| Clone or remove a voice | `voice.create` / `voice.delete` | Upload audio first for creation. |

## Generate images and videos

| Goal | Choose | Distinction |
|---|---|---|
| Prompt-only video | `video.text` | No image input. |
| Animate one image | `video.image` | Upload image, then pass its ID. |
| Apply a managed effect | `video.template` | Query live templates; this is not free-form generation. |
| Interpolate first and last frames | `video.transition` | Exactly two boundary frames. |
| Move through 2-7 ordered keyframes | `video.multi-transition` | Ordered per-segment durations. |
| Guide generation with named references | `video.fusion` | Image references, and supported video references/modes. |
| Generate from an image template | `image.template` | Poll with `image.status`. |
| Make a portrait speak | `video.avatar` | Portrait plus exactly one audio/TTS source. |

## Edit or augment existing video

| Goal | Choose | Do not confuse with |
|---|---|---|
| Align mouth movement to speech | `video.lip-sync` | Avatar creates from a portrait; lip sync edits video. |
| Change overall visual style | `video.restyle` | Modify changes prompted content. |
| Find replaceable regions | `video.swap-mask` | Run before `video.swap` when no mask is known. |
| Replace a selected subject/region | `video.swap` | Requires the selected keyframe/mask and replacement image. |
| Add synchronized generated audio | `video.sound-effect` | Does not perform speech lip sync. |
| Continue an existing clip | `video.extend` | Not transition between independent frames. |
| Transfer or replicate motion | `video.motion-control` | Not a general prompt edit. |
| Prompt-edit video content | `video.modify` | Optional masks/references narrow the edit. |
| Increase output resolution | `video.upscale` | Enhancement after a video exists. |

## Specialized agents and retrieval

- `agent.viral-recreation`: use reference images plus exactly one reference video for the viral-recreation workflow.
- `agent.real-estate`: use a listing URL or supported image set for a property-tour/ad workflow.
- `video.status` and `image.status`: poll a known ID; never repeat generation to check progress.

## Compound prerequisite chains

- Image-to-video: `upload.image` -> `video.image` -> `video.status`.
- Template video: `resource.templates` -> `upload.image` -> `video.template` -> `video.status`.
- Swap: source video -> `video.swap-mask` -> `upload.image` -> `video.swap` -> `video.status`.
- TTS lip sync: `resource.tts-speakers` or `voice.create` -> `video.lip-sync` -> `video.status`.
- Audio lip sync: `upload.media` -> `video.lip-sync` -> `video.status`.
- Fusion: upload/resolve references -> `video.fusion` -> `video.status`.
```

- [ ] **Step 5: Run the focused tests and skill validator**

Run:

```bash
node --test test/platform-skill.test.js
python3 /Users/john/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pixverse-platform-api
```

Expected: PASS for the Task 1 tests and `Skill is valid!` from the bundled validator. Do not create empty future reference files; Tasks 3 and 4 add each link together with its finished content.

- [ ] **Step 6: Commit the router and capability guide**

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api/SKILL.md .agents/skills/pixverse-platform-api/agents/openai.yaml .agents/skills/pixverse-platform-api/references/capabilities.md
git commit -m "docs: route PixVerse Platform API capabilities"
```

Before committing, `node --test test/platform-skill.test.js` must be green.

---

### Task 2: Make the operation catalog and every payload recipe executable contracts

**Files:**
- Modify: `test/platform-skill.test.js`
- Modify: `.agents/skills/pixverse-platform-api/references/operation-catalog.md`
- Modify: `.agents/skills/pixverse-platform-api/references/payload-examples.json`

**Interfaces:**
- Consumes: `PLATFORM_OPERATIONS`, `normalizeAndValidatePlatformInput(operation, input, context) -> Promise<{payload, query, pathParams, files, validationSummary}>`, and the checked inventory fixture.
- Produces: a 30-row Markdown table whose fields exactly match the executable catalog, and JSON shaped as `Record<operationId, {description: string, input: object, alternatives?: Array<{label: string, input: object}>}>`.

- [ ] **Step 1: Add failing metadata and payload-validation tests**

Append these helpers and tests to `test/platform-skill.test.js`:

```js
import { normalizeAndValidatePlatformInput } from "../src/platform/validation.js";

function parseCatalog(markdown) {
  const rows = markdown.split("\n")
    .filter((line) => /^\| operation:/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", "")));
  return new Map(rows.map((row) => [row[0].replace("operation:", ""), {
    command: row[1], method: row[2], path: row[3], billing: row[4],
    asynchronous: row[5], resultIdPath: row[6], prerequisite: row[7], documentationUrl: row[8],
  }]));
}

function visitIdentifiers(value, key = "") {
  if (Array.isArray(value)) return value.flatMap((item) => visitIdentifiers(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, child]) => visitIdentifiers(child, childKey));
  }
  return /(^|_)(id|ids)$/.test(key) ? [{ key, value }] : [];
}

test("operation reference is traceable to every executable catalog row", async () => {
  const catalog = parseCatalog(await readSkill("references/operation-catalog.md"));
  assert.equal(catalog.size, PLATFORM_OPERATIONS.length);
  for (const operation of PLATFORM_OPERATIONS) {
    const row = catalog.get(operation.id);
    assert.ok(row, `missing ${operation.id}`);
    assert.equal(row.command, `platform ${operation.command.join(" ")}`);
    assert.equal(row.method, operation.method);
    assert.equal(row.path, operation.path);
    assert.equal(row.billing, operation.billing);
    assert.equal(row.asynchronous, operation.asynchronous ? "yes" : "no");
    assert.equal(row.resultIdPath, operation.resultIdPath ?? "none");
    assert.notEqual(row.prerequisite, "");
    assert.equal(row.documentationUrl, operation.documentationUrl);
    assert.equal(new URL(row.documentationUrl).hostname, "docs.platform.pixverse.ai");
  }
});

test("every Platform operation has a safe locally valid recipe", async () => {
  const examples = JSON.parse(await readSkill("references/payload-examples.json"));
  assert.deepEqual(Object.keys(examples).sort(), PLATFORM_OPERATIONS.map(({ id }) => id).sort());

  for (const operation of PLATFORM_OPERATIONS) {
    const recipe = examples[operation.id];
    assert.equal(typeof recipe.description, "string");
    assert.ok(recipe.description.length > 0);
    const variants = [{ label: "primary", input: recipe.input }, ...(recipe.alternatives ?? [])];
    for (const variant of variants) {
      await normalizeAndValidatePlatformInput(operation, variant.input, {
        inspectLocalMedia: async () => assert.fail("examples must not require private local media"),
      });
      for (const identifier of visitIdentifiers(variant.input)) {
        if (Array.isArray(identifier.value)) {
          assert.equal(identifier.value.every((item) => typeof item === "string"), true);
        } else {
          assert.equal(typeof identifier.value, "string", `${operation.id}.${identifier.key}`);
        }
      }
    }
  }
});

test("payload recipes contain no credentials, private hosts, or production media URLs", async () => {
  const text = await readSkill("references/payload-examples.json");
  assert.doesNotMatch(text, /PIXVERSE_.*KEY|API-KEY|Bearer\s|api[_-]?key/i);
  for (const match of text.matchAll(/https?:\/\/[^"\\]+/g)) {
    assert.equal(new URL(match[0]).hostname.endsWith("example.test"), true);
  }
});
```

- [ ] **Step 2: Run the focused tests and verify the expected RED state**

Run:

```bash
node --test test/platform-skill.test.js
```

Expected: FAIL because the catalog lacks `resultIdPath`, prerequisite, and official URL columns, and the payload file has only three unwrapped examples.

- [ ] **Step 3: Enrich the operation catalog from the executable inventory**

Change the table header to exactly:

```markdown
| Marker | Command | Method | Path | Billing | Async | Result ID path | Key prerequisite/input boundary | Official docs |
|---|---|---:|---|---|---:|---|---|---|
```

For each `PLATFORM_OPERATIONS` entry, retain the literal marker and fill values from the executable operation. Use `none` when `resultIdPath` is null. The prerequisite column must be concrete, for example:

```markdown
| operation:video.image | `platform video image` | POST | `/openapi/v2/video/img/generate` | billable | yes | `Resp.video_id` | Uploaded `img_id` string plus prompt/model/duration/quality | https://docs.platform.pixverse.ai/image-to-video-generation-13016633e0 |
| operation:video.swap | `platform video swap` | POST | `/openapi/v2/video/swap/generate` | billable | yes | `Resp.video_id` | Source video, keyframe/mask from mask selection, replacement `img_id`, and quality | https://docs.platform.pixverse.ai/swap-video-generation-24001839e0 |
| operation:video.status | `platform video status` | GET | `/openapi/v2/video/result/{video_id}` | read-only | no | `Resp.id` | Known `video_id` string; never resubmit generation to poll | https://docs.platform.pixverse.ai/get-video-generation-status-13016632e0 |
```

Write all 30 rows; do not derive public meaning from method/path alone. Check each prerequisite against the validator and endpoint URL against `src/platform/operations.js`.

- [ ] **Step 4: Replace payload examples with a complete validated recipe map**

Use each operation's `test/fixtures/platform/<operation-id>/request.json` `input` as the primary seed, wrap it in `{description,input}`, and sanitize all remote inputs to `https://*.example.test/...`. Convert every identifier field to a string in the published recipe, including the numeric `keyframe_id` values in the swap fixtures. Include all 30 keys, including `{}` for `account.balance`.

Add these exact alternatives to demonstrate mutually exclusive choices without mixing them:

```json
{
  "video.lip-sync": {
    "description": "Lip-sync an existing Platform video using one audio source.",
    "input": {
      "source_video_id": "629000000000000005",
      "audio_media_id": "629000000000000003"
    },
    "alternatives": [
      {
        "label": "Use a TTS speaker and content instead of uploaded audio",
        "input": {
          "source_video_id": "629000000000000005",
          "lip_sync_tts_speaker_id": "speaker-7",
          "lip_sync_tts_content": "Welcome to the product tour."
        }
      }
    ]
  },
  "video.avatar": {
    "description": "Create a talking avatar from a portrait and one audio source.",
    "input": {
      "img_id": "629000000000000001",
      "quality": "720p",
      "audio_media_id": "629000000000000003"
    },
    "alternatives": [
      {
        "label": "Use TTS instead of uploaded audio",
        "input": {
          "img_id": "629000000000000001",
          "quality": "720p",
          "lip_sync_tts_speaker_id": "speaker-7",
          "lip_sync_tts_content": "Here is the latest update."
        }
      }
    ]
  },
  "agent.real-estate": {
    "description": "Create a real-estate video from a public listing URL.",
    "input": {
      "agent_id": "419629433597950",
      "model": "pro",
      "product_url": "https://listing.example.test/home"
    },
    "alternatives": [
      {
        "label": "Use an image set instead of a listing URL",
        "input": {
          "agent_id": "419629433597950",
          "model": "fast",
          "prompt": "Create a concise property tour.",
          "img_references": [
            { "img_url": "https://cdn.example.test/room-1.png" },
            { "img_url": "https://cdn.example.test/room-2.png" },
            { "img_url": "https://cdn.example.test/room-3.png" },
            { "img_url": "https://cdn.example.test/room-4.png" },
            { "img_url": "https://cdn.example.test/room-5.png" }
          ]
        }
      }
    ]
  }
}
```

Keep the two fixed documented `agent_id` values as strings. Every other example ID should be an obviously synthetic string such as `629000000000000001` or `speaker-7`. Do not include keys, local filesystem paths, real account data, or PixVerse production media URLs.

- [ ] **Step 5: Run catalog, payload, completeness, and validator tests**

Run:

```bash
node --test test/platform-skill.test.js test/catalog-completeness.test.js test/unit/platform-validation.test.js
```

Expected: PASS. This execution must perform no HTTP requests and must not inspect local media.

- [ ] **Step 6: Commit the executable references**

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api/references/operation-catalog.md .agents/skills/pixverse-platform-api/references/payload-examples.json
git commit -m "test: validate Platform skill catalog and recipes"
```

---

### Task 3: Document live model, pricing, upload, and concurrency facts without freezing them

**Files:**
- Modify: `test/platform-skill.test.js`
- Modify: `.agents/skills/pixverse-platform-api/SKILL.md`
- Create: `.agents/skills/pixverse-platform-api/references/models-pricing-and-limits.md`

**Interfaces:**
- Consumes: official docs pages for model overview, C1, V6, capability matrix, pricing, rate limits, endpoint-specific uploads, and the repository's checked validators.
- Produces: a dated compatibility and billing reference that distinguishes checked CLI behavior from volatile provider facts and tells the agent when to refresh them.

- [ ] **Step 1: Add a failing official-source and volatility test**

Append:

```js
test("model, pricing, and limit guidance is dated and linked to primary sources", async () => {
  const skill = await readSkill("SKILL.md");
  const reference = await readSkill("references/models-pricing-and-limits.md");
  const officialPages = [
    "https://docs.platform.pixverse.ai/model-overview-2140345m0",
    "https://docs.platform.pixverse.ai/c1-2067883m0",
    "https://docs.platform.pixverse.ai/v6-2056814m0",
    "https://docs.platform.pixverse.ai/capability-matrix-2144288m0",
    "https://docs.platform.pixverse.ai/pricing-796039m0",
    "https://docs.platform.pixverse.ai/rate-limit-796040m0",
    "https://docs.platform.pixverse.ai/upload-image-13016631e0",
    "https://docs.platform.pixverse.ai/upload-videoaudio-19094401e0",
  ];
  assert.match(skill, /references\/models-pricing-and-limits\.md/);
  assert.match(reference, /Verified against official docs: 2026-09-19/);
  assert.match(reference, /refresh|re-check|verify live/i);
  for (const page of officialPages) assert.ok(reference.includes(page), page);
  assert.doesNotMatch(reference, /654[- ]template/i);
});
```

- [ ] **Step 2: Run the focused test and verify the expected RED state**

Run:

```bash
node --test test/platform-skill.test.js
```

Expected: FAIL because `models-pricing-and-limits.md` does not exist.

- [ ] **Step 3: Write the dated model and capability matrix**

Create `references/models-pricing-and-limits.md` with the following facts and source policy:

```markdown
# Models, Pricing, and Limits

Verified against official docs: 2026-09-19.

These provider facts can change independently of this CLI. Re-check the linked official pages before making a current compatibility, price, credit, duration, resolution, upload, QPS, or concurrency claim. For templates, TTS speakers, restyle effects, balance, and usage, prefer the read-only Platform operations at execution time.

## Model choice

| Need | Checked guidance | Verify live |
|---|---|---|
| Text/image/transition/fusion generation | C1 or V6, subject to endpoint parameters | Model overview, C1, V6, capability matrix |
| Video extension | V6 in the checked matrix | V6 and capability matrix |
| Standalone restyle/swap/mimic/modify/sound/lip-sync/image-template work | Use its dedicated endpoint; do not assume the base model selector applies | Endpoint page and pricing |

Both current C1 and V6 pages describe up to 15 seconds and 1080p for their supported generation modes, but exact parameter combinations remain endpoint-specific. The CLI validators are the authority for what this installed CLI version accepts; the official docs are the authority for current provider availability.

## Billing distinctions

- Account/resource/status discovery is read-only.
- Upload and custom-voice management are cataloged as non-billable in this CLI version.
- Generation, editing, enhancement, swap-mask selection, and agents are cataloged as billable.
- Pricing may be per second, per request, or feature/model-specific. Consult the live pricing page and, for templates, the live returned credit metadata before stating cost.
- Platform API credits and membership are separate from PixVerse web-app credits.

## Limits and media boundaries

- Image upload validation accepts JPG/JPEG/PNG/WebP, requires size below 20 MB, and enforces dimensions no larger than 10,000 px in this CLI version.
- General media upload accepts MP4/MOV/WebM and MP3/WAV/M4A/AAC; video dimensions are capped at 1920 by the checked validator. Specialized endpoints can impose tighter size/duration/dimension rules.
- Concurrency depends on the current Platform membership. Query/consult the live rate-limit page and respect `Retry-After` or provider errors; do not encode membership concurrency as timeless constants.
```

Add a `Primary sources` section linking the eight exact official URLs from the test. Do not reproduce the full live price table or membership table. Explain that `resource.templates`, `resource.tts-speakers`, and `resource.restyle-effects` are the current source for those dynamic catalogs.

Add this router bullet to `SKILL.md` in the existing `Route the request` section:

```markdown
- Read [models, pricing, and limits](references/models-pricing-and-limits.md) when model compatibility, upload constraints, credits, throughput, templates, speakers, or presets affect the task; refresh volatile facts live.
```

- [ ] **Step 4: Run the focused tests and skill validator**

Run:

```bash
node --test test/platform-skill.test.js
python3 /Users/john/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pixverse-platform-api
```

Expected: PASS and `Skill is valid!`.

- [ ] **Step 5: Commit the volatile-facts reference**

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api/SKILL.md .agents/skills/pixverse-platform-api/references/models-pricing-and-limits.md
git commit -m "docs: add live Platform model and limit guidance"
```

---

### Task 4: Encode safe submission, recovery, webhook, and troubleshooting behavior

**Files:**
- Modify: `test/platform-skill.test.js`
- Modify: `.agents/skills/pixverse-platform-api/SKILL.md`
- Create: `.agents/skills/pixverse-platform-api/references/workflows-and-recovery.md`
- Create: `.agents/skills/pixverse-platform-api/references/troubleshooting.md`

**Interfaces:**
- Consumes: `submitPlatformJob`, `resumePlatformJob`, `normalizePlatformStatus`, `parsePlatformEnvelope`, `verifyPlatformWebhook`, `createPlatformWebhookHandler`, and current CLI raw restrictions.
- Produces: operational runbooks whose status table parses to the same meanings as `normalizePlatformStatus`, whose webhook rules match the implementation, and whose error actions prohibit duplicate billable submissions.

- [ ] **Step 1: Add failing workflow and status-contract tests**

Append:

```js
import { normalizePlatformStatus } from "../src/platform/status.js";

function parseStatusTable(markdown) {
  return new Map(markdown.split("\n")
    .filter((line) => /^\| [15678] \|/.test(line))
    .map((line) => {
      const [code, name, terminal] = line.split("|").slice(1, 4).map((cell) => cell.trim().replaceAll("`", ""));
      return [Number(code), { name, terminal: terminal === "yes" }];
    }));
}

test("workflow status meanings match the executable normalizer", async () => {
  const workflow = await readSkill("references/workflows-and-recovery.md");
  const rows = parseStatusTable(workflow);
  assert.equal(rows.size, 5);
  for (const code of [1, 5, 6, 7, 8]) {
    const actual = normalizePlatformStatus(code);
    assert.deepEqual(rows.get(code), { name: actual.status, terminal: actual.terminal });
  }
});

test("workflow and troubleshooting guidance preserves paid-call and webhook invariants", async () => {
  const skill = await readSkill("SKILL.md");
  const workflow = await readSkill("references/workflows-and-recovery.md");
  const troubleshooting = await readSkill("references/troubleshooting.md");
  assert.match(skill, /references\/workflows-and-recovery\.md/);
  assert.match(skill, /references\/troubleshooting\.md/);
  assert.match(workflow, /--dry-run/);
  assert.match(workflow, /run-job/);
  assert.match(workflow, /resume/);
  assert.match(workflow, /reconciliation_required/);
  assert.match(workflow, /verify.*before.*pars/i);
  assert.match(workflow, /return.*`ok`.*after/i);
  assert.match(workflow, /https:\/\/docs\.platform\.pixverse\.ai\/how-to-use-webhook-1905378m0/);
  assert.match(troubleshooting, /ErrCode.*zero|ErrCode.*0/i);
  assert.match(troubleshooting, /ambiguous/i);
  assert.match(troubleshooting, /do not.*resubmit|never.*resubmit|must not.*retry/i);
  assert.match(troubleshooting, /moderation/i);
  assert.match(troubleshooting, /rate|concurren/i);
});
```

- [ ] **Step 2: Run the focused test and verify the expected RED state**

Run:

```bash
node --test test/platform-skill.test.js
```

Expected: FAIL because the workflow and troubleshooting references do not exist.

- [ ] **Step 3: Write the workflow and recovery runbook**

Create `references/workflows-and-recovery.md` with exact executable sequences:

```markdown
# Workflows and Recovery

## Read-only discovery

1. Use `platform account balance` when remaining credits affect the decision.
2. Query templates, speakers, or restyle effects live rather than relying on a saved list.
3. Preserve returned IDs as strings in every payload and artifact.

## Upload, preflight, submit, poll

1. Upload the required image/media and preserve its returned string ID.
2. Save the specialized operation input to a JSON file.
3. Run `npm run cli -- platform <group> <action> --payload <file> --dry-run`.
4. Resolve validation errors before any live call.
5. Confirm the exact billable operation is authorized now; check balance/expected impact when material.
6. Run `npm run cli -- platform run-job --operation <operation-id> --payload <file> --poll` once.
7. Preserve `request.json`, create response, ID artifact, `polling.jsonl`, and `final.json` from the returned job directory.

## Resume

- Run `npm run cli -- platform resume <job-directory>` to continue polling a saved image/video ID.
- Resume never reissues generation. If the create outcome was ambiguous and no result ID exists, it returns `reconciliation_required`; stop and reconcile provider/account records instead of submitting again.
- A terminal `final.json` is returned without another provider call. A timed-out job with a known ID can resume polling safely.

## Platform statuses

| Code | Normalized status | Terminal |
|---|---|---|
| 1 | `succeeded` | yes |
| 5 | `processing` | no |
| 6 | `deleted` | yes |
| 7 | `moderation_failed` | yes |
| 8 | `failed` | yes |

Poll a known ID at the documented cadence and honor provider retry guidance. Preserve the original submission trace separately from status-request traces.

## Webhooks

Use the official webhook page to confirm current supported operations and delivery behavior. Verify timestamp, nonce, Base64 HMAC-SHA256 signature, time window, and nonce replay state before parsing JSON or invoking delivery logic. Return plain `ok` only after verified successful handling; use HTTPS and idempotent delivery processing.

## Raw diagnostics

Use `platform raw` only for a relative `/openapi/v2/` path when diagnosing a documented endpoint or inspecting a newly published endpoint not yet in the catalog. Start with `--dry-run`. Never pass API keys, cookies, host, content length, authorization, or trace headers; the CLI owns those headers and assigns a fresh trace.
```

Include command examples using `example.test`/synthetic IDs only, the durable artifact meanings from `src/platform/jobs.js`, and the official webhook URL `https://docs.platform.pixverse.ai/how-to-use-webhook-1905378m0`.

- [ ] **Step 4: Write proportional troubleshooting actions**

Create `references/troubleshooting.md` with this decision table and official links to `https://docs.platform.pixverse.ai/error-codes-796041m0` and `https://docs.platform.pixverse.ai/common-errors-and-solutions-882978m0`:

```markdown
# Troubleshooting

HTTP success is not Platform success. Require a valid response envelope and `ErrCode` equal to zero.

| Class | Evidence | Next action |
|---|---|---|
| Configuration/authentication | Missing `PIXVERSE_PLATFORM_API_KEY`, rejected key, wrong base URL | Stop; fix Platform configuration. Never substitute a Growth Studio or web credential. |
| Local input/media validation | CLI rejects field combinations, URL, type, size, dimensions, duration, or unsafe numeric ID | Fix the payload and rerun `--dry-run`; no provider request was made. |
| Provider parameter rejection | Nonzero parameter-related `ErrCode` | Compare the specialized example, local validator, and current endpoint page; change only the rejected input. |
| Moderation | Status 7 or moderation `ErrCode` | Treat as terminal. Report the provider reason; revise content only if the user asks. Do not hide or bypass moderation. |
| Rate/concurrency pressure | Rate/concurrency `ErrCode`, HTTP 429, or retry guidance | For read-only calls, wait as directed and retry safely. For a confirmed-not-accepted submission, follow provider guidance; if acceptance is ambiguous, reconcile instead of resubmitting. |
| Polling issue | Transient failure while a result ID is known | Preserve the ID and job directory; resume polling without recreating the generation. |
| Ambiguous billable submission | Timeout/connection loss after dispatch and no saved result ID | Do not retry or resubmit. Keep `request.json` and trace ID, inspect usage/provider records, and report `reconciliation_required`. |
| Terminal generation failure | Status 6, 7, or 8 | Preserve final status, trace, provider envelope, and failure details; do not automatically create a replacement job. |
| Missing result ID | Successful-looking create envelope lacks the cataloged ID path | Preserve create response and trace; stop as a response-contract error and reconcile. |
| Trace reuse | New request attempts caller-supplied/saved trace | Create a fresh request trace. Reuse saved trace only via the explicit recovery path. |
```

Also explain that read-only retry safety does not authorize a billable retry, and that secrets and raw response diagnostics must be redacted before sharing.

Add these router bullets to `SKILL.md` in the existing `Route the request` section:

```markdown
- Read [workflows and recovery](references/workflows-and-recovery.md) before uploads, billable submission, polling, resume, webhook handling, or raw diagnostics.
- Read [troubleshooting](references/troubleshooting.md) when configuration, validation, provider, moderation, status, rate, or ambiguous-submission errors occur.
```

- [ ] **Step 5: Run focused workflow, webhook, job, and envelope tests**

Run:

```bash
node --test test/platform-skill.test.js test/unit/platform-jobs.test.js test/unit/platform-webhooks.test.js test/unit/platform-status.test.js test/unit/platform-envelope.test.js test/e2e/platform-recovery.e2e.test.js test/e2e/platform-webhook.e2e.test.js
```

Expected: PASS with no paid network access.

- [ ] **Step 6: Commit operational guidance**

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api/SKILL.md .agents/skills/pixverse-platform-api/references/workflows-and-recovery.md .agents/skills/pixverse-platform-api/references/troubleshooting.md
git commit -m "docs: add safe Platform recovery and troubleshooting"
```

---

### Task 5: Run release gates and independent behavioral review

**Files:**
- Modify only if review finds a concrete gap: `.agents/skills/pixverse-platform-api/SKILL.md`
- Modify only if review finds a concrete gap: `.agents/skills/pixverse-platform-api/references/*.md`
- Modify only if review finds a concrete gap: `.agents/skills/pixverse-platform-api/references/payload-examples.json`
- Modify only if a regression is uncovered: `test/platform-skill.test.js`

**Interfaces:**
- Consumes: completed skill resource graph and all repository test/release commands.
- Produces: a validated skill, an independent behavioral assessment covering four realistic prompt classes, and a clean reviewable diff with no secrets or paid network calls.

- [ ] **Step 1: Validate the skill package directly**

Run:

```bash
python3 /Users/john/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/pixverse-platform-api
```

Expected: `Skill is valid!`.

- [ ] **Step 2: Run the guarded Platform and full repository suites**

Run:

```bash
npm run test:api
npm run test:coverage
npm test
```

Expected: all tests pass; coverage remains at least 80% for lines, branches, functions, and statements. `test:api` and `test:coverage` load `scripts/no-paid-network.js`, so any attempted production request must fail the test rather than spend credits.

- [ ] **Step 3: Run syntax, security, dependency, and diff gates**

Run:

```bash
npm run check
npm run security:scan
npm audit
git diff --check
git status --short
```

Expected: syntax and secret scan pass, `npm audit` reports no known vulnerabilities, `git diff --check` prints nothing, and status shows only intentional skill/test changes or is clean after the task commits.

- [ ] **Step 4: Dispatch an independent read-only behavioral reviewer**

Give a fresh reviewer only the skill path and these prompts; explicitly prohibit live generation, credential access, and network mutation:

```text
Review the skill at .agents/skills/pixverse-platform-api as if you were executing each request. Do not call the production API, read credentials, or spend credits.

1. "Show me my current Platform balance and list current video templates."
2. "Generate an image-to-video clip from a local image; explain exactly where approval is required."
3. "A billable create call timed out and the job directory has request.json but no video-id.json. Continue safely."
4. "A webhook arrived with JSON, timestamp, nonce, and signature. Explain the verification and acknowledgement order."

For each request, report selected references, chosen operations/commands, prerequisites, credential boundary, billing decision, and whether the proposed next step would be safe. Flag any missing or contradictory instruction; do not propose stylistic changes without a behavioral effect.
```

Expected reviewer outcomes:

- Prompt 1 chooses only read-only account/resource commands and refreshes dynamic templates live.
- Prompt 2 chooses upload then `video.image`, performs `--dry-run`, and stops for exact spend authorization immediately before the one live submission.
- Prompt 3 returns/recommends `reconciliation_required` and never resubmits.
- Prompt 4 verifies signature/timestamp/nonce/replay before parsing and returns plain `ok` only after successful handling.

- [ ] **Step 5: Address every concrete reviewer gap test-first**

For each behavioral gap, first add the smallest assertion to `test/platform-skill.test.js` that captures the violated invariant, run it to see RED, edit only the responsible skill/reference file, and rerun the focused test to GREEN. Do not add rules for hypothetical issues the reviewer did not demonstrate.

Run after any fix:

```bash
node --test test/platform-skill.test.js
npm run test:api
```

Expected: PASS.

- [ ] **Step 6: Perform the final spec and consistency audit**

Check each acceptance criterion against an artifact:

- 30 operation markers and 30 catalog rows: `test/platform-skill.test.js` plus `test/catalog-completeness.test.js`.
- Goal-based selection and compound prerequisites: `references/capabilities.md` plus reviewer prompts.
- Every operation recipe and alternative validation: payload test using `normalizeAndValidatePlatformInput`.
- Dynamic-fact refresh and official sources: `models-pricing-and-limits.md` and its source test.
- Provider isolation, spend approval, submit-once, ID strings, recovery, webhook order, and raw restrictions: entrypoint/workflow/troubleshooting references plus tests.
- No secrets, private media, or paid network: payload safety test, `security:scan`, and guarded API suite.

Search the plan's delivered skill resources for unfinished scaffold text or stale snapshot claims:

```bash
rg -n "654[- ]template|PIXVERSE_GROWTH_API_KEY|app\.pixverse\.ai.*session|\[PLACEHOLDER\]" .agents/skills/pixverse-platform-api
```

Expected: no matches. Mentions that explicitly explain the forbidden Growth credential boundary are allowed only if the search is narrowed and manually verified not to prescribe fallback.

- [ ] **Step 7: Commit reviewer-driven corrections, if any**

If Step 5 changed files:

```bash
git add test/platform-skill.test.js .agents/skills/pixverse-platform-api
git commit -m "docs: harden Platform skill behavior"
```

If Step 5 found no gaps, do not create an empty commit. Finish with `git status --short` and report the exact passing gates and commit IDs.
