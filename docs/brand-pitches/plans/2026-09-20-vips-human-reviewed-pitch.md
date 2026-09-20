# VIPS Human-Reviewed Pitch Page Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chinese-first private VIPS pitch page that leads with reviewed ecommerce proof, preserves all twenty-nine test rows and their attempt-level detail, and asks VIPS to select three workflows for a controlled pilot.

**Architecture:** A static HTML shell provides the proof-first hero, three featured cases, capability overview, pilot proposal, and no-JavaScript fallback. A sanitized `cases.json` corpus supplies the complete evidence ledger; small ES modules validate immutable data, render escaped markup, and progressively attach non-featured media. A local-only source-sync utility fetches Lark revision 1214 and downloads attachments without shipping Lark tokens or raw source metadata.

**Tech Stack:** Static HTML5, CSS custom properties mapped from PixVerse Design System v1.0.1, browser-native ES modules and `<details>`, Node.js 20 test runner, `c8`, `lark-cli`, `ffprobe`, and a local static HTTP server for QA.

**Spec:** `docs/brand-pitches/specs/2026-09-20-vips-human-reviewed-pitch-design.md`
## Global Constraints
- Follow `docs/brand-pitches/playbook.md`: proof first, one reader, one requested decision, one primary CTA.
- Source content is Lark document `YEE4dcLZAoiZC9x9vhzcZKLknsc`, revision `1214`; fetch that exact revision, not latest.
- The deployable corpus contains exactly five chapters with `11 / 3 / 3 / 9 / 3` test rows, totaling twenty-nine.
- Chinese is primary; preserve English only for product, workflow, and model names where it improves interpretation.
- Preserve each attempt, retry, prompt adjustment, and reviewer observation under the correct test row.
- Never strengthen `部分胜任` or `当前不建议直接使用` into `可胜任` during condensation.
- The executive layer does not expose prompts, operational identifiers, model internals, local paths, reviewer identity, or authenticated URLs.
- Detailed model/workflow labels and prompts may appear only inside the secondary `评审详情` disclosure when needed to interpret reviewed evidence.
- Default to a private `noindex, nofollow` preview. Do not deploy, distribute, upload media externally, add analytics, or make billable requests.
- Use only official/public-safe customer assets. If a publication-safe VIPS wordmark is not verified, use neutral editorial text and do not approximate the logo.
- Use PixVerse Design System v1.0.1 tokens. Dark-only; depth comes from white-alpha layers and blur; no static shadows, arbitrary brand colors, decorative gradient orbs, or letter spacing.
- The create gradient appears only on the single primary action, `选择试点工作流`.
- Every product-fidelity video uses centered `object-fit: contain` inline and fullscreen. Never use `cover` for reviewed evidence.
- All media and source content are untrusted input: validate types, escape text, allow only local paths or public HTTPS URLs, and prohibit executable SVG from unverified sources.
- Preserve unrelated working-tree changes. Patch the live `package.json` narrowly and stage only task-owned files.
- Use immutable transformations: never mutate the parsed corpus or case records.
- Each production JavaScript module stays below 400 lines; every file stays below 800 lines.
- Achieve at least 80% line, branch, function, and statement coverage for `data-model.js` and `render.js`.
---
### Task 1: Define And Validate The Reviewed Evidence Corpus
**Files:**
- Create: `test/vips-pitch-data.test.js`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json`

**Interfaces:**
- Consumes: Lark revision `1214` and the approved design spec.
- Produces: `cases.json` with schema version `vips-pitch.v1`, `featuredCaseIds`, five ordered chapters, and twenty-nine ordered cases.
- [ ] **Step 1: Write the failing corpus contract test**
Create `test/vips-pitch-data.test.js` with these constants and assertions:
```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const dataPath = path.join(pitchRoot, "data/cases.json");
const expectedCounts = Object.freeze({
  "viral-remix-and-editing": 11,
  "presenter-commerce": 3,
  "creative-commercial": 3,
  "product-motion": 9,
  "outfit-generation": 3,
});
const allowedVerdicts = new Set(["capable", "partially-capable", "not-recommended"]);

const readData = async () => JSON.parse(await fs.readFile(dataPath, "utf8"));

test("VIPS corpus preserves the exact reviewed scope", async () => {
  const data = await readData();
  assert.equal(data.schemaVersion, "vips-pitch.v1");
  assert.equal(data.source.revisionId, 1214);
  assert.equal(data.source.reviewedAt, "2026-09-20");
  assert.equal(data.chapters.length, 5);

  const ids = data.chapters.flatMap(({ cases }) => cases.map(({ id }) => id));
  assert.equal(ids.length, 29);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    Object.fromEntries(data.chapters.map(({ id, cases }) => [id, cases.length])),
    expectedCounts,
  );
});

test("every case retains evidence and attempt-level review", async () => {
  const data = await readData();
  for (const chapter of data.chapters) {
    assert.ok(allowedVerdicts.has(chapter.verdict), chapter.id);
    assert.ok(chapter.summary.trim(), chapter.id);
    for (const record of chapter.cases) {
      assert.ok(record.title.trim(), record.id);
      assert.ok(record.request.trim(), record.id);
      assert.ok(allowedVerdicts.has(record.review.verdict), record.id);
      assert.ok(record.review.summary.trim(), record.id);
      assert.ok(record.inputs.length + record.attempts.length > 0, record.id);
      assert.ok(record.attempts.every((attempt) =>
        attempt.label && Array.isArray(attempt.media) && Array.isArray(attempt.observations)
      ), record.id);
    }
  }
});

test("three featured cases represent distinct workflow chapters", async () => {
  const data = await readData();
  assert.equal(data.featuredCaseIds.length, 3);
  const chapterByCase = new Map(data.chapters.flatMap((chapter) =>
    chapter.cases.map((record) => [record.id, chapter.id])
  ));
  assert.equal(new Set(data.featuredCaseIds.map((id) => chapterByCase.get(id))).size, 3);
});

test("deployable data excludes confidential and executable references", async () => {
  const raw = await fs.readFile(dataPath, "utf8");
  assert.doesNotMatch(raw, /YEE4dcLZAoiZC9x9vhzcZKLknsc|token=|file_token|\/Users\/|mh_live_|API-KEY/i);
  assert.doesNotMatch(raw, /(?:href|src)\\?"?\s*:\s*\\?"(?:javascript:|data:text\/html)/i);
});
```
- [ ] **Step 2: Run the corpus test and verify the RED state**
Run:
```bash
node --test test/vips-pitch-data.test.js
```
Expected: FAIL with `ENOENT` for `data/cases.json`.
- [ ] **Step 3: Fetch the exact reviewed source into temporary storage**
Use a newly created `mktemp -d` directory and run:
```bash
lark-cli docs +fetch \
  --doc 'https://aisphere.feishu.cn/docx/YEE4dcLZAoiZC9x9vhzcZKLknsc' \
  --revision-id 1214 \
  --doc-format xml \
  --detail full \
  --as user \
  --format json
```
Keep the returned raw JSON only in the temporary directory. Do not add it to the repository. Confirm the response reports `document_id` matching the requested source and `revision_id: 1214` before converting any content.
- [ ] **Step 4: Create the concrete sanitized corpus**
Use `apply_patch` to create `cases.json`. The top-level structure must be:
```json
{
  "schemaVersion": "vips-pitch.v1",
  "source": {
    "label": "唯品会视频测试任务（人工评审）",
    "revisionId": 1214,
    "reviewedAt": "2026-09-20"
  },
  "featuredCaseIds": [
    "presenter-mens-jeans",
    "creative-skincare-ice",
    "product-motion-multi-pose"
  ],
  "chapters": []
}
```
Populate the ordered chapter IDs from `expectedCounts`. For every source table row, preserve this concrete shape:
```json
{
  "id": "presenter-mens-jeans",
  "title": "男式牛仔裤",
  "request": "基于多角度商品图，按六个分镜展示版型、弹力、透气与抗皱卖点。",
  "inputs": [
    {
      "type": "image",
      "label": "商品参考图",
      "url": "https://a.vpimg2.com/...",
      "sourceKind": "original-input",
      "alt": "浅蓝色男式直筒牛仔裤商品参考图"
    }
  ],
  "attempts": [
    {
      "id": "growth-studio-silent",
      "label": "Growth Studio 一键成片（无声版）",
      "method": "Growth Studio Agent",
      "parameters": ["9:16", "15 秒", "720p", "无音轨"],
      "prompt": "完整保留来源分镜提示词；无声版本关闭配音、字幕和背景音乐。",
      "media": [],
      "observations": [
        "显腿长、弹力、透气与抗皱卖点均有明确画面表达。",
        "商品颜色与参考图一致，未发现明显穿帮。"
      ],
      "verdict": "capable"
    }
  ],
  "review": {
    "verdict": "capable",
    "summary": "Agent 完整表达商品卖点，结果可直接进入下一轮业务评审。",
    "observations": []
  }
}
```
Replace the abbreviated example URL and empty media list with the exact sanitized records during conversion. Do not copy raw Lark tokens, reviewer names, or internal IDs. Retain precise timestamps such as `10.3–14.5 秒` whenever the source review uses them.
- [ ] **Step 5: Reconcile all rows against revision 1214**
Check off a temporary reconciliation sheet with exactly these chapter totals:
```text
爆款复刻与单镜头编辑  11/11
真人带货               3/3
创意广告               3/3
商品动效               9/9
穿搭生成               3/3
总计                  29/29
```
For every case, compare request, attempt ordering, prompt adjustment, output label, defect note, and final verdict with the source. Delete the temporary sheet after reconciliation; the test and final corpus are the durable proof.
- [ ] **Step 6: Run the corpus test and verify GREEN**
Run:
```bash
node --test test/vips-pitch-data.test.js
```
Expected: all four tests PASS.
- [ ] **Step 7: Commit the validated corpus**
```bash
git add test/vips-pitch-data.test.js deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json
git commit -m "feat: add validated VIPS review corpus"
```
---
### Task 2: Build The Sanitized Media Ingestion Utility
**Files:**
- Create: `scripts/sync-vips-pitch-media.mjs`
- Create: `test/unit/vips-pitch-media.test.js`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data/media-manifest.json`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/images/`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/videos/`

**Interfaces:**
- Consumes: a temporary revision-1214 Lark fetch response and `cases.json` media selectors.
- Produces: sanitized local media files and a token-free manifest containing `id`, `path`, `mimeType`, `bytes`, `sha256`, dimensions, duration, and source kind.
- [ ] **Step 1: Write failing unit tests for media parsing and safe naming**
Create tests that import these exact exports:
```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssetName,
  extractMediaReferences,
  validateDownloadedMedia,
} from "../../scripts/sync-vips-pitch-media.mjs";

test("extractMediaReferences keeps source order without exposing tokens in public ids", () => {
  const referenceAttribute = ["to", "ken"].join("");
  const content = `<img ${referenceAttribute}="fixture-image-ref" name="look.png" mime="image/png"/>` +
    `<source ${referenceAttribute}="fixture-video-ref" name="result.mp4" mime="video/mp4" size="42"/>`;
  const refs = extractMediaReferences(content);
  assert.deepEqual(refs.map(({ publicId, name, mimeType }) => ({ publicId, name, mimeType })), [
    { publicId: "media-001", name: "look.png", mimeType: "image/png" },
    { publicId: "media-002", name: "result.mp4", mimeType: "video/mp4" },
  ]);
  assert.doesNotMatch(JSON.stringify(refs.map(({ publicId }) => publicId)), /fixture/);
});

test("buildAssetName creates deterministic case-scoped paths", () => {
  assert.equal(
    buildAssetName({ caseId: "presenter-mens-jeans", attempt: 1, mediaIndex: 2, mimeType: "video/mp4" }),
    "presenter-mens-jeans-attempt-01-media-02.mp4",
  );
});

test("validateDownloadedMedia rejects MIME and extension disagreement", async () => {
  await assert.rejects(
    validateDownloadedMedia({ declaredMime: "video/mp4", detectedMime: "text/html", extension: ".mp4" }),
    /MIME mismatch/,
  );
});
```
- [ ] **Step 2: Run the media unit tests and verify RED**
Run:
```bash
node --test test/unit/vips-pitch-media.test.js
```
Expected: FAIL because the sync module does not exist.
- [ ] **Step 3: Implement the pure media helpers**
Create immutable exports with these signatures:
```js
export function extractMediaReferences(xmlContent) {}
export function buildAssetName({ caseId, attempt, mediaIndex, mimeType }) {}
export async function validateDownloadedMedia({ declaredMime, detectedMime, extension }) {}
export async function syncMedia({ sourcePath, corpusPath, outputRoot, larkBin = "lark-cli" }) {}
```
Implementation requirements:

- Parse only `<img>` and `<source>` elements with a token, name, and supported MIME type.
- Allow `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, and `video/quicktime`; reject executable or unknown types.
- Use `execFile`, never a shell string, for `lark-cli docs +media-download`.
- Store the source token only in function-local memory and the ignored temporary source map.
- Detect actual MIME with `file --brief --mime-type`; probe videos with `ffprobe -v error -of json`.
- Calculate SHA-256 with `node:crypto`.
- Write the public manifest without tokens, authenticated URLs, raw Lark metadata, or reviewer identity.
- Refuse to overwrite an existing file when its hash differs; surface the conflict for review.
- Do not transcode by default. Preserve the reviewed artifact unless browser incompatibility or confidentiality requires a documented derivative.
- [ ] **Step 4: Run unit tests and verify GREEN**
```bash
node --test test/unit/vips-pitch-media.test.js
```
Expected: all media helper tests PASS.
- [ ] **Step 5: Download and map the reviewed attachments**
Run the sync utility against the temporary revision-1214 response and `cases.json`. Map selected feature aliases by source filename and chapter context:
```text
男式牛仔裤_GrowthStudio_Agent_无声.mp4 -> featured-presenter.mp4
PixVerseAgent_720P_FOR.mp4              -> featured-creative.mp4
06.mp4 in 商品场景                      -> featured-product-motion.mp4
```
All other files use `buildAssetName`. If a duplicate filename occurs, resolve it through its source table and case ID rather than occurrence guessing.
- [ ] **Step 6: Add asset existence and confinement assertions to the corpus test**
Append this logic to `test/vips-pitch-data.test.js`:
```js
const collectMedia = (data) => data.chapters.flatMap(({ cases }) =>
  cases.flatMap(({ inputs, attempts }) => [
    ...inputs,
    ...attempts.flatMap(({ media }) => media),
  ])
);

test("every local evidence asset exists inside the pitch root", async () => {
  const data = await readData();
  for (const media of collectMedia(data).filter(({ path: assetPath }) => assetPath)) {
    const absolute = path.resolve(pitchRoot, media.path);
    assert.ok(absolute.startsWith(`${pitchRoot}${path.sep}`), media.path);
    await fs.access(absolute);
  }
});
```
- [ ] **Step 7: Verify media and commit**
Run:
```bash
node --test test/unit/vips-pitch-media.test.js test/vips-pitch-data.test.js
find deploy/brand-pitches/vips/human-reviewed-ecommerce/assets -type f -print0 | xargs -0 file --mime-type
find deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/videos -type f -print0 | xargs -0 -n1 ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json
```
Expected: tests PASS; every file has an allowed MIME; every video is readable and reports dimensions and duration.

Commit only the sanitized utility, tests, manifest, and public-safe assets:
```bash
git add scripts/sync-vips-pitch-media.mjs test/unit/vips-pitch-media.test.js \
  test/vips-pitch-data.test.js deploy/brand-pitches/vips/human-reviewed-ecommerce
git commit -m "feat: package VIPS reviewed media"
```
---
### Task 3: Implement Safe Immutable Data And Rendering Modules
**Files:**
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`
- Create: `test/unit/vips-pitch-data-model.test.js`
- Create: `test/unit/vips-pitch-render.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces from `data-model.js`: `validatePitchData(data)`, `flattenCases(data)`, `getVerdictMeta(verdict)`, and `getFeaturedCases(data)`.
- Produces from `render.js`: `escapeHtml(value)`, `safeUrl(value)`, `renderCase(record)`, `renderChapter(chapter)`, and `renderLedger(data)`.
- Consumes: validated `vips-pitch.v1` data only.
- [ ] **Step 1: Write failing immutable data-model tests**
Cover these behaviors:
```js
test("flattenCases preserves order without mutating input", () => {
  const before = structuredClone(fixture);
  const records = flattenCases(fixture);
  assert.equal(records.length, 29);
  assert.deepEqual(fixture, before);
  assert.ok(Object.isFrozen(records));
});

test("getVerdictMeta returns Chinese text and non-color status symbol", () => {
  assert.deepEqual(getVerdictMeta("partially-capable"), {
    label: "部分胜任",
    symbol: "△",
    className: "is-partial",
  });
});

test("validatePitchData rejects unsafe media schemes", () => {
  const unsafe = structuredClone(fixture);
  unsafe.chapters[0].cases[0].inputs[0].url = "javascript:alert(1)";
  assert.throws(() => validatePitchData(unsafe), /Unsafe media URL/);
});
```
The fixture must include all three verdicts, local and HTTPS media, a prompt containing `<script>`, and multiple attempts.
- [ ] **Step 2: Write failing renderer tests**
Test escaped text, independent details, accessible media, safe external links, and stable deep links:
```js
test("renderCase escapes untrusted prompt text", () => {
  const html = renderCase(fixture.chapters[0].cases[0]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("renderCase keeps review evidence inside native independent disclosures", () => {
  const html = renderCase(fixture.chapters[0].cases[0]);
  assert.match(html, /<details class="case-record"/);
  assert.match(html, /<details class="review-detail"/);
  assert.match(html, /评审详情/);
  assert.doesNotMatch(html, /name="accordion"/);
});

test("rendered external links are HTTPS and noreferrer", () => {
  const html = renderLedger(fixture);
  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
    assert.match(tag, /href="https:\/\//);
    assert.match(tag, /rel="noreferrer"/);
  }
});
```
- [ ] **Step 3: Run both unit suites and verify RED**
```bash
node --test test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js
```
Expected: FAIL because both modules are missing.
- [ ] **Step 4: Implement `data-model.js`**
Requirements:

- Validate schema, chapter IDs, counts, verdict enum, unique IDs, required review fields, and safe media paths.
- Accept URLs only when they are repository-local relative paths or public `https:` URLs without userinfo.
- Return new frozen arrays and wrapper objects; never add properties to parsed records.
- Use the exact verdict mapping shown in the unit test, plus `✓ / 可胜任 / is-capable` and `× / 当前不建议直接使用 / is-not-recommended`.
- `getFeaturedCases` resolves the three IDs in `featuredCaseIds` order and throws when an ID is missing or duplicated.
- [ ] **Step 5: Implement `render.js`**
Requirements:

- Escape `&`, `<`, `>`, `"`, and `'` in every text field.
- Build attribute values only from `safeUrl` and escaped stable IDs.
- Render media with `controls`, `playsinline`, `preload="none"`, an accessible Chinese label, motion description, and a sibling unavailable-state element.
- Store non-featured media paths in `data-src` and `data-poster`; do not set eager `src` attributes.
- Render attempt labels, parameters, observations, timestamps, prompts, and verdicts under the correct case.
- Do not render raw document identifiers, attachment tokens, reviewer identity, or model/job internals not present in the sanitized corpus.
- [ ] **Step 6: Add the dedicated coverage command without overwriting concurrent package changes**
Read the live `package.json`, preserve every existing script, and append the VIPS patterns to `test:pitches`. Add:
```json
"test:vips-pitch:coverage": "c8 --check-coverage --lines 80 --branches 80 --functions 80 --statements 80 --include 'deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js' --include 'deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js' node --test test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js"
```
The final `test:pitches` value must include `test/vips-*.test.js` and `test/unit/vips-pitch-*.test.js` in addition to all existing pitch patterns.
- [ ] **Step 7: Run unit tests and coverage**
```bash
node --test test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js
npm run test:vips-pitch:coverage
```
Expected: all tests PASS and all four coverage metrics are at least 80%.
- [ ] **Step 8: Commit the tested rendering foundation**
```bash
git add -p package.json
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js \
  test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js
git diff --cached -- package.json
git commit -m "feat: add safe VIPS evidence renderer"
```
---
### Task 4: Build The Proof-First Static Page Shell
**Files:**
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`
- Create: `test/vips-pitch-page.test.js`
- Copy: `deploy/brand-pitches/revolve/v4/assets/pixverse-logo.svg` to `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/pixverse-logo.svg`

**Interfaces:**
- Consumes: three featured records from `cases.json` and sanitized featured media aliases.
- Produces: semantic static page shell with usable featured proof, summary, pilot, and ledger failure fallback before JavaScript enhancement.
- [ ] **Step 1: Write the failing page-story tests**
Create tests that assert:
```js
test("VIPS page follows the approved Chinese proof-first story", async () => {
  const html = await readPage();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /真实商品，真实测试，人工评审/);
  assert.ok(position(html, "featured") < position(html, "capabilities"));
  assert.ok(position(html, "capabilities") < position(html, "ledger"));
  assert.ok(position(html, "ledger") < position(html, "pilot"));
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("VIPS page exposes one decision and one primary action", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*primary-action/g) ?? []).length, 1);
  assert.match(html, /href="#pilot"[^>]*>\s*选择试点工作流\s*</);
  assert.match(visibleText(html), /选择三个优先电商工作流/);
  assert.doesNotMatch(visibleText(html), /价格|SLA|已约定|保证|承诺/);
});

test("three featured cases remain usable without JavaScript", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*featured-case/g) ?? []).length, 3);
  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 2);
  assert.match(html, /男式牛仔裤/);
  assert.match(html, /冰晶护肤创意/);
  assert.match(html, /商品动效/);
});
```
Also assert the navigation labels `重点结果`, `能力总览`, `完整评审`, and `建议试点`; skip link; semantic landmarks; revision `1214`; private-proposal disclaimer; and absence of model/job IDs in visible hero and pilot text.
- [ ] **Step 2: Run the page test and verify RED**
```bash
node --test test/vips-pitch-page.test.js
```
Expected: FAIL because `index.html` is missing.
- [ ] **Step 3: Implement the semantic HTML shell**
Create:

- Compact customer-context header with the official PixVerse mark and neutral editorial title `唯品会电商视频能力评估`; do not typeset an imitation VIPS logo.
- Skip link to `#main`.
- Hero with the approved headline, concise source context, and the one primary CTA.
- Three static featured `<article>` elements using the sanitized aliases and human-reviewed summaries.
- Five capability summary links with visible symbol and text status.
- `#ledger` containing the static loading/failure fallback and an empty enhancement mount.
- `#pilot` asking the customer to select three workflow families and jointly confirm products, source assets, channels, exact product details, scorecard, and regeneration limits.
- Footer disclaimer: private capability proposal, based on revision 1214, reviewed 2026-09-20, not a public VIPS endorsement.
- Module script references for `app.js`; no third-party JavaScript.
- [ ] **Step 4: Run the page tests and verify GREEN**
```bash
node --test test/vips-pitch-page.test.js
```
Expected: all page-story tests PASS.
- [ ] **Step 5: Commit the proof-first shell**
```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/pixverse-logo.svg \
  test/vips-pitch-page.test.js
git commit -m "feat: add VIPS proof-first pitch shell"
```
---
### Task 5: Apply The PixVerse Visual System And Evidence Spine
**Files:**
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css`
- Modify: `test/vips-pitch-page.test.js`

**Interfaces:**
- Consumes: class names and landmarks in `index.html` and rendered ledger markup.
- Produces: responsive desktop/mobile compositions, canonical tokens, evidence spine, and accessible media framing.
- [ ] **Step 1: Add failing design-system and responsive assertions**
Add tests that read `styles.css` and assert:
```js
assert.match(css, /--background-primary:\s*#000000/);
assert.match(css, /--text-secondary:\s*rgba\(255, 255, 255, 0\.6\)/);
assert.match(css, /--create:\s*linear-gradient\(90deg, #ffa052 0%, #e046a4 45%, #6851eb 100%\)/);
assert.match(css, /font-family:\s*"Plus Jakarta Sans"/);
assert.match(css, /font-family:\s*"Inconsolata"/);
assert.match(css, /\.evidence-media video[\s\S]*object-fit:\s*contain/);
assert.match(css, /video:-webkit-full-screen[\s\S]*object-fit:\s*contain/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /@media\s*\(max-width:\s*639px\)/);
assert.doesNotMatch(css, /box-shadow\s*:|object-fit:\s*cover|letter-spacing\s*:/);
```
- [ ] **Step 2: Run the page suite and verify RED**
```bash
node --test test/vips-pitch-page.test.js
```
Expected: FAIL because `styles.css` is missing.
- [ ] **Step 3: Implement `styles.css` from canonical tokens**
Define local CSS custom properties mapped exactly from PixVerse Design System v1.0.1. Implement:

- Pure-black canvas; primary, secondary, and tertiary white text opacity.
- White-alpha fills at 8% resting and 16% hover; 12% borders.
- One create-gradient primary action.
- 56-pixel compact header, 24-pixel page gutters, 4-pixel spacing grid.
- Three-column featured grid where space permits; bounded portrait players with stable aspect ratios.
- Sticky desktop chapter navigation and quiet vertical evidence spine.
- Horizontally scrollable mobile section navigation and single-column evidence.
- Status symbol plus text; color remains supplementary.
- `overflow-wrap: anywhere` for prompt and observation content.
- Centered `contain` behavior for portrait, landscape, square, inline, and fullscreen media.
- Visible focus, 44-pixel targets, 200% zoom resilience, anchor offsets, reduced-motion overrides.
- [ ] **Step 4: Run tests and verify GREEN**
```bash
node --test test/vips-pitch-page.test.js
```
Expected: all page and style tests PASS.
- [ ] **Step 5: Commit the visual system**
```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css test/vips-pitch-page.test.js
git commit -m "feat: style VIPS human-review ledger"
```
---
### Task 6: Render And Progressively Load The Complete Ledger
**Files:**
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js`
- Modify: `test/vips-pitch-page.test.js`
- Create: `test/vips-pitch-e2e.test.js`

**Interfaces:**
- Consumes: `./data/cases.json`, validators from `data-model.js`, and renderers from `render.js`.
- Produces: five rendered chapters, twenty-nine independently expandable cases, deferred media loading, deep links, and useful failure states.
- [ ] **Step 1: Add failing app safety and behavior tests**
Assert that `app.js`:

- Imports only local modules.
- Fetches exactly `./data/cases.json`.
- Calls `validatePitchData` before `renderLedger`.
- Does not contain `innerHTML =`, `eval`, `new Function`, analytics endpoints, form submission, or billable APIs.
- Uses `<template>` parsing or `Range#createContextualFragment` only on markup returned by the escaping renderer, then `replaceChildren`.
- Creates one `IntersectionObserver` with a positive root margin.
- Copies `data-src` and `data-poster` to real attributes only before intersection.
- Provides an observer-unavailable fallback.
- Handles `error` events by revealing `视频暂不可用` without removing review text.
- Handles fetch failure by showing `完整评审暂不可用，请稍后重试。` while leaving hero and pilot untouched.
- [ ] **Step 2: Write the failing static-delivery E2E test**
Use a Node `http` server rooted at the pitch directory. Fetch `/`, `/data/cases.json`, `/styles.css`, `/app.js`, `/data-model.js`, `/render.js`, and each local media path. Assert HTTP 200, expected MIME types, and no path traversal. This is the integration/E2E test for the self-contained artifact.
- [ ] **Step 3: Run both suites and verify RED**
```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
```
Expected: FAIL because `app.js` and the complete delivery behavior are missing.
- [ ] **Step 4: Implement `app.js`**
Use this flow:
```js
import { validatePitchData } from "./data-model.js";
import { renderLedger } from "./render.js";

const DATA_URL = "./data/cases.json";

export async function loadPitchData(fetchImpl = fetch) {
  const response = await fetchImpl(DATA_URL, { credentials: "omit" });
  if (!response.ok) throw new Error(`Pitch data request failed: ${response.status}`);
  return validatePitchData(await response.json());
}
```
Then:

- Convert the escaped renderer string into a fragment without executing scripts.
- Replace only the ledger mount; never replace hero, featured proof, or pilot.
- Attach media `error` handlers before assigning sources.
- Observe every `[data-src]`; on intersection copy safe values, call `video.load()`, and unobserve.
- When `IntersectionObserver` is absent, attach all deferred paths immediately.
- On deep link to a case ID, open its ancestor `<details>` elements and focus the case summary without forced animation.
- Keep disclosure controls independent; do not implement exclusive accordion behavior.
- Freeze or copy collections before transformations; do not mutate corpus records.
- [ ] **Step 5: Run unit, page, and E2E suites**
```bash
node --test test/unit/vips-pitch-*.test.js test/vips-pitch-*.test.js
npm run test:vips-pitch:coverage
```
Expected: all tests PASS; renderer/model coverage remains at least 80%.
- [ ] **Step 6: Commit the complete evidence ledger**
```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js \
  test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
git commit -m "feat: render complete VIPS evidence ledger"
```
---
### Task 7: Add Private-Preview Security And Release Verification
**Files:**
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/_headers`
- Create: `test/vips-pitch-release.test.js`
- Modify: `deploy/brand-pitches/README.md`
- Modify: `docs/brand-pitches/README.md`

**Interfaces:**
- Consumes: the complete pitch artifact.
- Produces: private-preview headers, release audit tests, documented location, and a verified local handoff.
- [ ] **Step 1: Write failing security-header and release tests**
Require the following header policy:
```text
/*
  X-Robots-Tag: noindex, nofollow
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; media-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
```
Release tests must also scan every text file under the pitch root and reject:
```text
Lark document and attachment tokens
/Users/ paths
mh_live_ credentials
API keys and bearer tokens
internal job IDs
reviewer names or email addresses
analytics scripts
http:// mixed content
javascript: and data:text/html URLs
```
Allow the neutral source label and numeric revision `1214`.
- [ ] **Step 2: Run the release test and verify RED**
```bash
node --test test/vips-pitch-release.test.js
```
Expected: FAIL because `_headers` and README entries are missing.
- [ ] **Step 3: Add headers and documentation**
- Add `_headers` exactly as specified.
- Add `vips/human-reviewed-ecommerce/` to the deploy README as a private local preview, not a public release.
- Add the approved design spec and implementation plan to the documentation README.
- State explicitly that public deployment, external distribution, analytics, and asset uploads remain unapproved.
- [ ] **Step 4: Run all automated verification**
```bash
node --test test/vips-pitch-*.test.js test/unit/vips-pitch-*.test.js
npm run test:vips-pitch:coverage
npm run test:pitches
npm run check
npm run security:scan
```
Expected: all tests PASS; coverage is at least 80%; syntax and secret scans report no findings.
- [ ] **Step 5: Perform technical media verification**
```bash
find deploy/brand-pitches/vips/human-reviewed-ecommerce/assets -type f -print0 | xargs -0 file --mime-type
find deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/videos -type f -print0 | xargs -0 -n1 ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json
```
Expected: every asset matches its manifest; every video is readable; dimensions and durations match the reviewed record; audio presence or absence matches the source notes.
- [ ] **Step 6: Perform browser review**
Start a local range-capable static server. Review in a real browser at widths `320`, `390`, `768`, `1280`, and `1920` pixels, plus 200% zoom and reduced motion.

Verify:

- Strongest proof appears in the first viewport.
- Navigation, deep links, disclosures, keyboard focus, and error fallbacks work.
- No horizontal overflow occurs.
- One initial poster loads on mobile and no more than three on desktop; ledger media stays deferred.
- One portrait, one landscape, and one square example preserve `contain` inline and fullscreen.
- Long prompts wrap safely.
- Every chapter and all twenty-nine cases match Lark revision 1214.
- The page stops at local private preview; no publish or distribution action occurs.
- [ ] **Step 7: Review the complete diff and commit the verified release**
Inspect only task-owned files:
```bash
git diff -- deploy/brand-pitches/vips/human-reviewed-ecommerce \
  docs/brand-pitches deploy/brand-pitches/README.md \
  test/vips-pitch-*.test.js test/unit/vips-pitch-*.test.js \
  scripts/sync-vips-pitch-media.mjs package.json
```
Confirm unrelated working changes remain untouched, then commit:
```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce \
  docs/brand-pitches/README.md deploy/brand-pitches/README.md \
  test/vips-pitch-release.test.js
git commit -m "test: verify VIPS private pitch release"
```
## Execution Handoff
The implementation should use fresh task ownership and review gates. The recommended sequence is Tasks 1–2 for evidence and media integrity, Tasks 3–6 for the customer experience, then Task 7 for release validation. Do not begin customer distribution or deployment as part of this plan.
