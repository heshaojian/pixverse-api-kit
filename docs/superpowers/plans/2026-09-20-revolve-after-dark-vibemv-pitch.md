# REVOLVE “After Dark” VibeMV Pitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one product-faithful REVOLVE VibeMV proof from one original 20-second instrumental and present the approved result in a private, proof-first pitch page.

**Architecture:** Keep paid production separate from the deployable page. Pure production helpers build and validate the exact music and MiniApp requests; ignored job artifacts preserve private receipts and recovery state; a sanitized tracked proof record is the only bridge into the static pitch page. The page consumes no credentials or internal IDs and ships only after media QA passes.

**Tech Stack:** Node.js 20+ ES modules, Node test runner, PixVerse Agent Plugin wrapper (`pvx`), PixVerse CLI 1.4.5-compatible MiniApps commands, FFmpeg/ffprobe, static HTML/CSS/JavaScript, Codex browser QA.

**Spec:** `docs/superpowers/specs/2026-09-20-revolve-after-dark-vibemv-pitch-design.md`

## Global Constraints

- Work in an isolated worktree created from commit `180dcb9` or a descendant containing the approved spec; do not edit the dirty main checkout.
- Target only the `US TEAM` workspace using its resolved live workspace ID as a per-command `--workspace-id` override; never change the persisted default or use Personal/Growth credits.
- The authorized paid batch is exactly one 20-second instrumental music task and one VibeMV task; no variants, retries, extensions, upgrades, or replacement submissions.
- Run authentication, workspace, balance, slots, VibeMV schema, music capability, and exact in-app cost estimate checks before paid submission.
- If the VibeMV cost estimate cannot be observed before generation, or the estimate changes after the approved request is assembled, stop without submitting.
- Submit each paid task once, preserve its returned ID before polling, and reconcile ambiguous responses instead of resubmitting.
- Use the three controlled `LIOR-WD140` product images as truth; select one live VibeMV character reference without changing the source asset.
- The music request must use `music-3.0`, `--instrumental`, `--no-duration-auto`, and `--duration-seconds 20` after the live capability query confirms `10 <= 20 <= 240`.
- The VibeMV request must use `9:16`, `1080p`, disabled lip-sync, disabled subtitles, and the live schema fields returned immediately before submission.
- Reject critical garment, anatomy, reflection, framing, audio, subtitle, or lip-sync failures. A rejected result is not regenerated and is not placed on the page.
- Keep the page private: `noindex`, generic/private-safe metadata, no analytics, no public deployment, and no external communication.
- Customer-facing files must contain no credentials, local paths, internal job IDs, signed URLs, prices, prompts, model names, or production receipts.

---

## File Structure

### Production helpers

- Create `scripts/revolve-vibemv/production.js` — immutable product truth, request builders, schema/workspace guards, audio/result validators, and release-record sanitizer.
- Create `scripts/revolve-vibemv/prepare.js` — writes the ignored production packet and prompts from pure helpers without network access.
- Create `test/revolve-vibemv-production.test.js` — unit contract for the packet, workspace boundary, live schema, 20-second audio gate, and public-data sanitizer.

### Runtime artifacts

- Create, but do not track, `pixverse-cli-jobs/revolve-vibemv/` — preflight snapshots, prompt, upload receipts, paid submission receipts, polling results, downloaded music/MV, ffprobe output, frame contact sheet, and detailed QA.

### Deployable proof

- Create `deploy/brand-pitches/revolve/vibemv/proof.json` — sanitized approved output URL, product URL, public motion description, poster path, duration, aspect ratio, and QA scores.
- Create `deploy/brand-pitches/revolve/vibemv/index.html` — proof-first pitch markup.
- Create `deploy/brand-pitches/revolve/vibemv/styles.css` — responsive editorial visual system and contained media presentation.
- Create `deploy/brand-pitches/revolve/vibemv/app.js` — hero media state, audio-progress line, fallback behavior, and reduced-motion-safe enhancements.
- Create `deploy/brand-pitches/revolve/vibemv/_headers` and `robots.txt` — private-preview indexing and security controls.
- Copy approved existing assets into `deploy/brand-pitches/revolve/vibemv/assets/`: `revolve-wordmark.png`, `pixverse-logo.svg`, and the newly selected poster JPEG.
- Create `test/revolve-vibemv-pitch.test.js` — proof record, copy, privacy, media, accessibility, and asset contract.

---

### Task 1: Build the Offline Production Contract

**Files:**
- Create: `scripts/revolve-vibemv/production.js`
- Create: `scripts/revolve-vibemv/prepare.js`
- Create: `test/revolve-vibemv-production.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: controlled images under `assets/revolve-pilot-controlled-images/LIOR-WD140/` and the approved design spec.
- Produces: `PRODUCT`, `buildMusicRequest()`, `buildVibeMvParams(media)`, `assertMusicCapability(capability)`, `assertVibeMvSchema(info)`, `assertUsTeam(snapshot)`, `assertAudioProbe(probe)`, `sanitizeApprovedProof(input)`, and an ignored `production-packet.json`.

- [ ] **Step 1: Write the failing production-contract tests**

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT,
  assertAudioProbe,
  assertMusicCapability,
  assertUsTeam,
  assertVibeMvSchema,
  buildMusicRequest,
  buildVibeMvParams,
  sanitizeApprovedProof,
} from "../scripts/revolve-vibemv/production.js";

test("production packet is one 20-second instrumental plus one 9:16 1080p VibeMV", () => {
  assert.equal(PRODUCT.id, "LIOR-WD140");
  assert.deepEqual(buildMusicRequest(), {
    model: "music-3.0",
    instrumental: true,
    durationAuto: false,
    durationSeconds: 20,
    promptFile: "pixverse-cli-jobs/revolve-vibemv/music-prompt.txt",
    outputFile: "pixverse-cli-jobs/revolve-vibemv/after-dark-20s.mp3",
  });
  assert.deepEqual(buildVibeMvParams({ audioPath: "uploads/after-dark.mp3", imagePath: "uploads/lior-wd140-v1.jpg" }), {
    audio_info: "uploads/after-dark.mp3",
    video_style: "Cinematic",
    music_style: "Pop",
    lipsync_switch: false,
    subtitle_switch: false,
    image: "uploads/lior-wd140-v1.jpg",
    ratio: "9:16",
    quality: "1080p",
  });
});

test("preflight rejects the wrong workspace or an incomplete live schema", () => {
  assert.throws(() => assertUsTeam({ account_info: { workspace: { name: "Growth", workspaceId: 1 } } }), /US TEAM/);
  assert.equal(assertUsTeam({ account_info: { workspace: { name: "US TEAM", workspaceId: 425048085335168 } } }), 425048085335168);
  assert.throws(() => assertVibeMvSchema({ app_id: "vibe_mv", params_schema: [] }), /audio_info/);
});

test("music and audio gates require explicit 20-second support and output", () => {
  assert.doesNotThrow(() => assertMusicCapability({
    capability: { models: { "music-3.0": { parameters: { duration_seconds: { min: 10, max: 240 } } } } },
  }));
  assert.doesNotThrow(() => assertAudioProbe({ format: { duration: "20.018000" }, streams: [{ codec_type: "audio" }] }));
  assert.throws(() => assertAudioProbe({ format: { duration: "58.000000" }, streams: [{ codec_type: "audio" }] }), /20 seconds/);
});

test("approved proof is public-safe and contains no operational identifiers", () => {
  const proof = sanitizeApprovedProof({
    videoUrl: "https://media.pixverse.ai/pixverse/demo.mp4",
    poster: "./assets/after-dark-poster.jpg",
    durationSeconds: 20,
    qa: { productFidelity: 5, humanMotion: 4, framing: 5, brandFit: 5, technical: 4, audioFit: 5, pitchUsefulness: 5 },
    projectId: "425000000000001",
    localPath: "/Users/john/private/result.mp4",
  });
  assert.equal(proof.schemaVersion, "revolve-vibemv-proof.v1");
  assert.equal(proof.product.id, "LIOR-WD140");
  assert.equal("projectId" in proof, false);
  assert.equal(JSON.stringify(proof).includes("/Users/"), false);
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --test test/revolve-vibemv-production.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/revolve-vibemv/production.js`.

- [ ] **Step 3: Implement the immutable request builders and guards**

```js
const REQUIRED_VIBEMV_FIELDS = Object.freeze([
  "audio_info", "video_style", "music_style", "lipsync_switch",
  "subtitle_switch", "image", "ratio", "quality",
]);

export const PRODUCT = Object.freeze({
  id: "LIOR-WD140",
  brand: "LIONESS",
  name: "Stars Align Mini Dress",
  color: "Onyx",
  productUrl: "https://www.revolve.com/lioness-stars-align-mini-dress-in-onyx/dp/LIOR-WD140/",
  sourceImages: Object.freeze([
    "assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V1.jpg",
    "assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V2.jpg",
    "assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V3.jpg",
  ]),
});

export function buildMusicRequest() {
  return Object.freeze({
    model: "music-3.0",
    instrumental: true,
    durationAuto: false,
    durationSeconds: 20,
    promptFile: "pixverse-cli-jobs/revolve-vibemv/music-prompt.txt",
    outputFile: "pixverse-cli-jobs/revolve-vibemv/after-dark-20s.mp3",
  });
}

export function buildVibeMvParams({ audioPath, imagePath }) {
  if (!audioPath || !imagePath) throw new Error("VibeMV requires uploaded audio and image media paths.");
  return Object.freeze({
    audio_info: audioPath,
    video_style: "Cinematic",
    music_style: "Pop",
    lipsync_switch: false,
    subtitle_switch: false,
    image: imagePath,
    ratio: "9:16",
    quality: "1080p",
  });
}

export function assertMusicCapability(result) {
  const range = result?.capability?.models?.["music-3.0"]?.parameters?.duration_seconds;
  if (!range || range.min > 20 || range.max < 20) throw new Error("music-3.0 does not support an explicit 20-second duration.");
}

export function assertVibeMvSchema(result) {
  if (result?.app_id !== "vibe_mv") throw new Error("Live MiniApp is not vibe_mv.");
  const names = new Set((result.params_schema ?? []).map(({ name }) => name));
  for (const field of REQUIRED_VIBEMV_FIELDS) if (!names.has(field)) throw new Error(`Live VibeMV schema is missing ${field}.`);
  return result;
}

export function assertUsTeam(snapshot) {
  const workspace = snapshot?.account_info?.workspace;
  if (workspace?.name !== "US TEAM" || !Number.isSafeInteger(workspace.workspaceId)) {
    throw new Error("Paid generation must target the live US TEAM workspace.");
  }
  return workspace.workspaceId;
}

export function assertAudioProbe(probe) {
  const duration = Number(probe?.format?.duration);
  const hasAudio = (probe?.streams ?? []).some(({ codec_type: type }) => type === "audio");
  if (!hasAudio || !Number.isFinite(duration) || Math.abs(duration - 20) > 0.25) {
    throw new Error("Music output must contain audio and measure 20 seconds within 250 ms.");
  }
}
```

Implement `sanitizeApprovedProof()` as a new-object projection that accepts only the approved `media.pixverse.ai` HTTPS URL, local poster path, fixed product record, duration/aspect ratio, public motion description, and seven numeric QA scores. Reject scores below 1 or above 5 and reject an average below 4.

- [ ] **Step 4: Add the offline packet writer**

`scripts/revolve-vibemv/prepare.js` must create `pixverse-cli-jobs/revolve-vibemv/` plus its `preflight/`, `uploads/`, and `output/` subdirectories, write `music-prompt.txt`, and atomically write `production-packet.json`. The prompt text is:

```text
A complete 20-second instrumental cinematic synth-pop cue for a premium after-dark fashion film, 120 BPM, immediate glassy synth hook, tight electronic drums, warm controlled sub-bass, cool reflective atmosphere, one clean lift at the midpoint, and a resolved final beat. No vocals, spoken words, crowd sounds, artist imitation, or recognizable copyrighted melody.
```

Expose it through `package.json`:

```json
"prepare:revolve-vibemv": "node scripts/revolve-vibemv/prepare.js",
"test:revolve-vibemv": "node --test test/revolve-vibemv-production.test.js test/revolve-vibemv-pitch.test.js"
```

- [ ] **Step 5: Run the focused production tests and offline prepare command**

Run:

```bash
node --test test/revolve-vibemv-production.test.js
npm run prepare:revolve-vibemv
node --input-type=module -e 'import fs from "node:fs"; const p=JSON.parse(fs.readFileSync("./pixverse-cli-jobs/revolve-vibemv/production-packet.json", "utf8")); if(p.music.durationSeconds!==20||p.vibemv.ratio!=="9:16"||p.vibemv.quality!=="1080p")process.exit(1)'
```

Expected: tests PASS; the ignored packet contains one music request and one VibeMV request with no network activity.

- [ ] **Step 6: Commit the production contract**

```bash
git add package.json scripts/revolve-vibemv/production.js scripts/revolve-vibemv/prepare.js test/revolve-vibemv-production.test.js
git commit -m "feat: define REVOLVE VibeMV production contract"
```

---

### Task 2: Preflight and Generate the Original Track Exactly Once

**Files:**
- Runtime only: `pixverse-cli-jobs/revolve-vibemv/preflight/`
- Runtime only: `pixverse-cli-jobs/revolve-vibemv/music-*`

**Interfaces:**
- Consumes: `production-packet.json`, `buildMusicRequest()`, PixVerse CLI capabilities, live `US TEAM` workspace snapshot.
- Produces: one saved music submission/result ID, `after-dark-20s.mp3`, `music-ffprobe.json`, and before/after credit snapshots for reconciliation.

- [ ] **Step 1: Refresh the managed runtime and capture read-only readiness**

Run:

```bash
PVX=/Users/john/.codex/plugins/cache/openai-curated-remote/pixverse/1.3.0/scripts/pvx
"$PVX" bootstrap --yes
"$PVX" doctor > pixverse-cli-jobs/revolve-vibemv/preflight/doctor.json
"$PVX" pixverse workspace list --json > pixverse-cli-jobs/revolve-vibemv/preflight/workspaces.json
"$PVX" billing snapshot > pixverse-cli-jobs/revolve-vibemv/preflight/billing-before.json
"$PVX" pixverse capabilities create music --model music-3.0 --json > pixverse-cli-jobs/revolve-vibemv/preflight/music-capability.json
"$PVX" pixverse miniapps info vibe_mv --json > pixverse-cli-jobs/revolve-vibemv/preflight/vibemv-schema.json
```

Expected: authenticated Premium account; active/target workspace resolves to `US TEAM`; at least one shared video slot remains; music capability includes explicit 10–240 second duration support; VibeMV schema contains every required field.

- [ ] **Step 2: Validate readiness through the production guards**

Add a small `scripts/revolve-vibemv/check-preflight.js` entrypoint that imports the captured JSON documents and calls `assertMusicCapability`, `assertVibeMvSchema`, and `assertUsTeam`. Pass `billing-before.json` to `assertUsTeam()`; its authoritative live shape is `account_info.workspace`, while `workspaces.json` is corroborating inventory only. Test the entrypoint first with a failing wrong-workspace billing fixture inside `test/revolve-vibemv-production.test.js`, then run:

```bash
node scripts/revolve-vibemv/check-preflight.js
```

Expected: prints a JSON object containing only `ready: true`, the numeric `workspaceId`, and `tasks: 2`; no email, account ID, or token is printed.

- [ ] **Step 3: Submit the one authorized music task**

Resolve `US_WORKSPACE_ID` from the validated preflight output, then run exactly once:

```bash
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" create music \
  --model music-3.0 \
  --instrumental \
  --no-duration-auto \
  --duration-seconds 20 \
  --prompt pixverse-cli-jobs/revolve-vibemv/music-prompt.txt \
  --client-request-id revolve-after-dark-music-20260920 \
  --output pixverse-cli-jobs/revolve-vibemv/after-dark-20s.mp3 \
  --json > pixverse-cli-jobs/revolve-vibemv/music-result.json
```

Expected: one task ID is saved in `music-result.json`; the command does not run a second time under any failure mode.

- [ ] **Step 4: Reconcile and validate the downloaded track**

If the command times out after returning an ID, poll that ID with `pixverse task wait <id> --type audio --json`; if no ID was saved, stop as `reconciliation_required`.

Run:

```bash
ffprobe -v error -show_streams -show_format -of json \
  pixverse-cli-jobs/revolve-vibemv/after-dark-20s.mp3 \
  > pixverse-cli-jobs/revolve-vibemv/music-ffprobe.json
node scripts/revolve-vibemv/check-audio.js pixverse-cli-jobs/revolve-vibemv/music-ffprobe.json
"$PVX" billing snapshot > pixverse-cli-jobs/revolve-vibemv/preflight/billing-after-music.json
```

`check-audio.js` reads JSON and calls `assertAudioProbe()`. Expected: audio stream exists and duration is 19.75–20.25 seconds.

- [ ] **Step 5: Record the Task 2 checkpoint without tracking private receipts**

Extend `test/revolve-vibemv-production.test.js` to verify the check-preflight/check-audio entrypoints export testable functions, then commit only code and tests:

```bash
git add scripts/revolve-vibemv/check-preflight.js scripts/revolve-vibemv/check-audio.js test/revolve-vibemv-production.test.js
git commit -m "test: gate REVOLVE VibeMV preflight and audio"
```

---

### Task 3: Price, Submit, Reconcile, and QA One VibeMV

**Files:**
- Runtime only: `pixverse-cli-jobs/revolve-vibemv/uploads/`
- Runtime only: `pixverse-cli-jobs/revolve-vibemv/vibemv-*`
- Create after approval: `deploy/brand-pitches/revolve/vibemv/proof.json`
- Create after approval: `deploy/brand-pitches/revolve/vibemv/assets/after-dark-poster.jpg`
- Modify: `test/revolve-vibemv-production.test.js`

**Interfaces:**
- Consumes: validated 20-second audio, one selected controlled product image, live VibeMV schema, live in-app estimate, `buildVibeMvParams()`.
- Produces: exactly one VibeMV project/result, detailed private QA, one public-safe `proof.json`, and one selected poster.

- [ ] **Step 1: Add the failing approved-proof persistence test**

```js
test("tracked proof is sanitized and approved before page work begins", async () => {
  const raw = await fs.readFile(new URL("../deploy/brand-pitches/revolve/vibemv/proof.json", import.meta.url), "utf8");
  const proof = JSON.parse(raw);
  assert.equal(proof.schemaVersion, "revolve-vibemv-proof.v1");
  assert.equal(proof.product.id, "LIOR-WD140");
  assert.equal(proof.durationSeconds, 20);
  assert.equal(proof.aspectRatio, "9:16");
  assert.match(proof.videoUrl, /^https:\/\/media\.pixverse\.ai\//);
  assert.equal(Object.values(proof.qa).every((score) => score >= 1 && score <= 5), true);
  assert.ok(Object.values(proof.qa).reduce((sum, score) => sum + score, 0) / 7 >= 4);
  assert.doesNotMatch(raw, /projectId|taskId|job|prompt|credits|\/Users\/|API-KEY|Authorization/i);
});
```

- [ ] **Step 2: Run the proof test and verify it fails**

Run: `node --test test/revolve-vibemv-production.test.js`

Expected: FAIL with `ENOENT` for `deploy/brand-pitches/revolve/vibemv/proof.json`.

- [ ] **Step 3: Upload the approved inputs without submitting generation**

Use `LIOR-WD140_V1.jpg` unless visual inspection finds that V2 or V3 provides a clearer front-facing full-body reference. Upload the final selection and the validated track once, saving both returned media paths:

```bash
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" asset upload \
  assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V1.jpg \
  --json > pixverse-cli-jobs/revolve-vibemv/uploads/character.json
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" asset upload \
  pixverse-cli-jobs/revolve-vibemv/after-dark-20s.mp3 \
  --json > pixverse-cli-jobs/revolve-vibemv/uploads/audio.json
node scripts/revolve-vibemv/build-vibemv-params.js \
  pixverse-cli-jobs/revolve-vibemv/uploads/audio.json \
  pixverse-cli-jobs/revolve-vibemv/uploads/character.json \
  > pixverse-cli-jobs/revolve-vibemv/vibemv-params.json
```

Add and test `build-vibemv-params.js` as a thin parser around `buildVibeMvParams()`; reject URLs and require CLI media paths.

- [ ] **Step 4: Obtain and record the exact pre-submit cost ceiling**

Open the official VibeMV page in the Codex in-app browser, select the `US TEAM` workspace, load the same uploaded audio/image, and set the closest live-supported labels to Cinematic and Pop, with lip-sync off, subtitles off, 9:16, and 1080p. Confirm the exact live labels match the strings in `vibemv-params.json`; if they differ, update the pure builder and its test before pricing. Record the displayed estimate in `pixverse-cli-jobs/revolve-vibemv/preflight/vibemv-estimate.json` with `checked_at`, `workspace_id`, `duration_seconds`, `quality`, `ratio`, exact style labels, and `credits`.

Do not click Generate in the browser. If the estimate is missing, changes after the final settings are applied, or cannot be tied to `US TEAM`, stop without submitting.

- [ ] **Step 5: Submit the one authorized VibeMV task**

Run exactly once:

```bash
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" miniapps create \
  --id vibe_mv \
  --params pixverse-cli-jobs/revolve-vibemv/vibemv-params.json \
  --no-wait \
  --json > pixverse-cli-jobs/revolve-vibemv/vibemv-submission.json
```

Expected: one `project_id` is persisted. If the response is ambiguous and contains no ID, stop; do not run the command again.

- [ ] **Step 6: Poll, download, and reconcile credits**

```bash
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" task wait "$PROJECT_ID" \
  --type miniapps --timeout 1800 --json \
  > pixverse-cli-jobs/revolve-vibemv/vibemv-result.json
"$PVX" pixverse --workspace-id "$US_WORKSPACE_ID" asset download "$PROJECT_ID" \
  --type miniapps --dest pixverse-cli-jobs/revolve-vibemv/output/ --json \
  > pixverse-cli-jobs/revolve-vibemv/vibemv-download.json
"$PVX" billing snapshot > pixverse-cli-jobs/revolve-vibemv/preflight/billing-after-vibemv.json
```

Expected: terminal success, one main MP4, and observed credit reduction no greater than the recorded estimate. Any overage or nonterminal state stops the workflow.

- [ ] **Step 7: Perform media QA and select the poster**

Generate a private contact sheet at 2-second intervals and inspect the full video with sound. Save seven 1–5 scores plus explicit critical-failure booleans in `pixverse-cli-jobs/revolve-vibemv/vibemv-qa.json`. Select the first clean, centered, mostly still product-readable frame and export it as `deploy/brand-pitches/revolve/vibemv/assets/after-dark-poster.jpg`.

The QA script must fail unless the mean score is at least 4 and every critical-failure flag is false. It must not create `proof.json` on rejection.

- [ ] **Step 8: Write and verify the sanitized approved proof**

Call `sanitizeApprovedProof()` using the final `media.pixverse.ai` URL, poster path, duration, and QA scores, then atomically write `deploy/brand-pitches/revolve/vibemv/proof.json`.

Run:

```bash
node --test test/revolve-vibemv-production.test.js
npm run security:scan
git diff --check
```

Expected: production tests PASS; security scan finds no secrets; only `proof.json`, the poster, helper code, and tests are trackable.

- [ ] **Step 9: Commit the approved proof bridge**

```bash
git add deploy/brand-pitches/revolve/vibemv/proof.json \
  deploy/brand-pitches/revolve/vibemv/assets/after-dark-poster.jpg \
  scripts/revolve-vibemv/build-vibemv-params.js \
  scripts/revolve-vibemv/qa.js \
  test/revolve-vibemv-production.test.js
git commit -m "feat: approve REVOLVE VibeMV proof"
```

---

### Task 4: Build the Proof-First Private Pitch Page

**Files:**
- Create: `deploy/brand-pitches/revolve/vibemv/index.html`
- Create: `deploy/brand-pitches/revolve/vibemv/styles.css`
- Create: `deploy/brand-pitches/revolve/vibemv/app.js`
- Create: `deploy/brand-pitches/revolve/vibemv/_headers`
- Create: `deploy/brand-pitches/revolve/vibemv/robots.txt`
- Copy: `deploy/brand-pitches/revolve/v4/assets/revolve-wordmark.png` to `deploy/brand-pitches/revolve/vibemv/assets/revolve-wordmark.png`
- Copy: `deploy/brand-pitches/revolve/v4/assets/pixverse-logo.svg` to `deploy/brand-pitches/revolve/vibemv/assets/pixverse-logo.svg`
- Create: `test/revolve-vibemv-pitch.test.js`

**Interfaces:**
- Consumes: sanitized `proof.json`, approved poster, official brand assets, product URL.
- Produces: private static pitch page with one hero video, one pilot proposal, and one CTA.

- [ ] **Step 1: Write the failing page contract**

```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const root = new URL("../deploy/brand-pitches/revolve/vibemv/", import.meta.url);

test("VibeMV pitch is proof-first, private, and uses one approved hero", async () => {
  const [html, css, app, proof, headers, robots] = await Promise.all([
    fs.readFile(new URL("index.html", root), "utf8"),
    fs.readFile(new URL("styles.css", root), "utf8"),
    fs.readFile(new URL("app.js", root), "utf8"),
    fs.readFile(new URL("proof.json", root), "utf8").then(JSON.parse),
    fs.readFile(new URL("_headers", root), "utf8"),
    fs.readFile(new URL("robots.txt", root), "utf8"),
  ]);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(html, /Make the next drop move to its own beat\./);
  assert.equal((html.match(/<video\b/g) ?? []).length, 1);
  assert.ok(html.indexOf("<video") < html.indexOf("controlled pilot"));
  assert.match(html, /Select three products for a controlled pilot/);
  assert.ok(html.includes(proof.videoUrl));
  assert.match(css, /\.hero-media video[^}]*object-fit:\s*contain/s);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(app, /timeupdate/);
  assert.match(app, /prefers-reduced-motion/);
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow, noarchive/i);
  assert.match(robots, /Disallow:\s*\//);
});

test("deployable files expose no internal production data", async () => {
  const names = ["index.html", "styles.css", "app.js", "proof.json", "_headers", "robots.txt"];
  const raw = (await Promise.all(names.map((name) => fs.readFile(new URL(name, root), "utf8")))).join("\n");
  assert.doesNotMatch(raw, /API-KEY|Authorization|workspace_id|project_id|task_id|credits|prompt|\/Users\//i);
  assert.doesNotMatch(raw, /official partnership|REVOLVE needs|creative velocity/i);
});
```

- [ ] **Step 2: Run the pitch test and verify the page is missing**

Run: `node --test test/revolve-vibemv-pitch.test.js`

Expected: FAIL with `ENOENT` for `index.html`.

- [ ] **Step 3: Implement semantic proof-first markup**

Build `index.html` in this order:

1. Skip link and compact REVOLVE × PixVerse header.
2. Hero eyebrow `A music-led social concept for REVOLVE`.
3. Headline `Make the next drop move to its own beat.`
4. One contained 9:16 video with approved poster, native controls, `playsinline`, `preload="metadata"`, accessible label, motion description, media-failure message, product link, and direct-video link.
5. Two-sentence proof statement naming the LIONESS product without explaining models or workflows.
6. Three-product, seven-day pilot with the four proposed observable criteria.
7. One anchor CTA labeled `Select three products for a controlled pilot` targeting the pilot section, not email or external outreach.
8. Footer disclaimer: `Private concept preview prepared by PixVerse from public REVOLVE product references. Not an official REVOLVE endorsement.`

- [ ] **Step 4: Implement the subject-specific visual system**

Use these exact tokens in `styles.css`:

```css
:root {
  --ink: #050608;
  --surface: #0d1015;
  --surface-raised: #151922;
  --paper: #f5f7fa;
  --muted: #9aa3b2;
  --line: rgba(255, 255, 255, 0.14);
  --signal: #8eb8ff;
  --reflection: #c9d8f2;
  --focus: #ffffff;
  --display: "Arial Narrow", "Helvetica Neue", sans-serif;
  --body: "Helvetica Neue", Arial, sans-serif;
  --utility: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

The hero uses an asymmetrical two-column desktop layout with the 9:16 proof occupying the dominant left column and the pitch thesis aligned to its upper-right edge. Collapse to one column below 840px. The one signature element is a 2px audio-progress line whose position is driven by the hero video; no equalizer bars, gradients, or ambient ornaments.

- [ ] **Step 5: Implement resilient media behavior**

`app.js` must:

- Set `--progress` from `currentTime / duration` on `timeupdate`.
- Reset progress on `ended`.
- Add `media-unavailable` on `error` and reveal the direct link/fallback.
- Avoid scripted autoplay.
- Respect `matchMedia("(prefers-reduced-motion: reduce)")` by disabling nonessential page-load transitions.
- Leave all links, copy, video controls, and the pilot section usable without JavaScript.

- [ ] **Step 6: Add private-preview controls and approved assets**

`_headers`:

```text
/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`robots.txt`:

```text
User-agent: *
Disallow: /
```

Copy the existing approved REVOLVE wordmark and sanitized PixVerse SVG without changing either file.

- [ ] **Step 7: Run page and production tests**

Run:

```bash
node --test test/revolve-vibemv-production.test.js test/revolve-vibemv-pitch.test.js
npm run test:pitches
npm run check
git diff --check
```

Expected: all focused and existing pitch tests PASS; syntax and whitespace checks PASS.

- [ ] **Step 8: Commit the private pitch page**

```bash
git add deploy/brand-pitches/revolve/vibemv test/revolve-vibemv-pitch.test.js package.json
git commit -m "feat: build private REVOLVE VibeMV pitch"
```

---

### Task 5: Browser QA, Security Review, and Final Release Gate

**Files:**
- Modify only if QA finds a defect: `deploy/brand-pitches/revolve/vibemv/index.html`
- Modify only if QA finds a defect: `deploy/brand-pitches/revolve/vibemv/styles.css`
- Modify only if QA finds a defect: `deploy/brand-pitches/revolve/vibemv/app.js`
- Modify only if QA finds a contract gap: `test/revolve-vibemv-pitch.test.js`

**Interfaces:**
- Consumes: complete private page and approved proof record.
- Produces: QA-clean local artifact with no external publication.

- [ ] **Step 1: Start a local server and open the page in the Codex browser**

Run:

```bash
python3 -m http.server 4173 --directory deploy/brand-pitches/revolve/vibemv
```

Open `http://127.0.0.1:4173/` in the Codex in-app browser.

- [ ] **Step 2: Verify desktop presentation at 1440 × 1000**

Confirm the hero proof is visible in the first viewport, the dress is fully contained, the headline and CTA do not compete with playback, native controls work, the progress line follows actual playback, keyboard focus is visible, and no horizontal overflow appears.

- [ ] **Step 3: Verify mobile presentation at 390 × 844**

Confirm the layout becomes a single readable composition, the full 9:16 video remains visible without crop, touch targets are at least 44px, the brand lockup fits, and the CTA remains obvious after the proof.

- [ ] **Step 4: Verify reduced motion, zoom, and failure states**

Test reduced-motion preference, 200% zoom, blocked video loading, keyboard-only navigation, and JavaScript disabled. The poster, motion description, product link, direct-video link, pilot copy, and CTA must remain available.

- [ ] **Step 5: Run independent code and security reviews**

Use the project’s code-reviewer agent on the full branch diff and security-reviewer agent on the deployable directory. Resolve every CRITICAL or HIGH finding and rerun the affected focused test before continuing.

- [ ] **Step 6: Run the complete local release gate**

```bash
npm run test:revolve-vibemv
npm run test:pitches
npm test
npm run check
npm run security:scan
npm audit --audit-level=high
git diff --check
git status --short
```

Expected: all tests pass; audit reports no high-severity vulnerability; secret scan and whitespace checks pass; only intended branch changes are present.

- [ ] **Step 7: Commit QA corrections, if any**

```bash
git add deploy/brand-pitches/revolve/vibemv test/revolve-vibemv-pitch.test.js
git commit -m "fix: complete REVOLVE VibeMV pitch QA"
```

Skip this commit only when QA required no file changes.

- [ ] **Step 8: Stop at the private handoff**

Open the local page for user review and report the approved music file, MV file, sanitized proof record, pitch-page path, exact credit usage, and test results. Do not deploy, publish, push, message REVOLVE, add analytics, or create a public share link.
