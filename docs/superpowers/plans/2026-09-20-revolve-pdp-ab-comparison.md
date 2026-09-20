# REVOLVE 0911 vs PDP Standard/high Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing local-only REVOLVE PDP review gallery into a fourteen-product, apples-to-apples comparison between the 0911 Original videos and the PDP Standard/high videos.

**Architecture:** Keep the release static and isolated under `deploy/brand-pitches/revolve/pdp-review/`. A validated v2 catalog supplies the matched media; small ES modules own validation, immutable local review state, pair playback, and safe rendering; `app.js` only wires those modules to the page shell. Unit tests cover the modules, release-contract tests bind the page to the original 0911 and PDP campaign artifacts, and browser QA verifies the real responsive experience.

**Tech Stack:** Static HTML/CSS, browser-native ES modules, JSON, Node.js 20 `node:test`, `c8`, native video controls, `localStorage`, and `IntersectionObserver`.

**Spec:** `docs/brand-pitches/specs/2026-09-20-revolve-pdp-ab-comparison-design.md`

## Global Constraints

- Work directly on `main`, as previously authorized; do not create a feature branch or worktree.
- The repository root is currently registered with `core.bare=true` even though the work-tree files are present. Until that metadata is intentionally repaired, use `git --git-dir=.git --work-tree=.` for Git status, add, diff, and commit operations; do not change repository configuration as part of this feature.
- Do not modify `deploy/brand-pitches/revolve/v4/` or deploy to `revolve-pixverse-0911`.
- Do not deploy the comparison page. Publication remains a separate explicit approval.
- Do not generate, edit, transcode, or submit any billable media job.
- Use the exact labels `A — 0911 Original` and `B — PDP Standard/high`; do not infer or claim a generation mode for the 0911 source.
- Keep all media centered with `object-fit: contain` inline and fullscreen.
- Preserve `noindex, nofollow, noarchive`; do not add analytics, cookies, authentication, or remote form submission.
- Use PixVerse design-system tokens: pure black canvas, white-alpha depth, Plus Jakarta Sans, no decorative shadows, and no decorative gradients.
- Preserve unrelated untracked campaign payloads, uploads, scripts, and tests; stage only files named by each task.
- Use immutable state transitions and validate the catalog and stored review values at their boundaries.
- New comparison modules must maintain at least 80% line, branch, function, and statement coverage.

## File Structure

- Modify `deploy/brand-pitches/revolve/pdp-review/catalog.json` — sanitized v2 matched-source catalog.
- Create `deploy/brand-pitches/revolve/pdp-review/data-model.js` — catalog and URL validation plus immutable normalized data.
- Create `deploy/brand-pitches/revolve/pdp-review/review-store.js` — versioned local preference state with in-memory fallback.
- Create `deploy/brand-pitches/revolve/pdp-review/pair-controller.js` — pair-local playback, exclusive audio, and active-pair coordination.
- Create `deploy/brand-pitches/revolve/pdp-review/render.js` — escaped semantic comparison-row markup.
- Modify `deploy/brand-pitches/revolve/pdp-review/app.js` — page bootstrap, event wiring, lazy media, progress, and failure states.
- Modify `deploy/brand-pitches/revolve/pdp-review/index.html` — accessible comparison shell and ES-module entry point.
- Modify `deploy/brand-pitches/revolve/pdp-review/styles.css` — edit-review layout, equal A/B frames, controls, and responsive stacking.
- Create `deploy/brand-pitches/revolve/pdp-review/assets/posters/0911/*.jpg` — copies of the fourteen approved 0911 poster frames.
- Create `test/unit/revolve-pdp-comparison-data-model.test.js` — catalog boundary tests.
- Create `test/unit/revolve-pdp-review-store.test.js` — persistence and fallback tests.
- Create `test/unit/revolve-pdp-pair-controller.test.js` — synchronized pair behavior tests.
- Create `test/unit/revolve-pdp-render.test.js` — escaping and semantic markup tests.
- Modify `test/revolve-pdp-review-release.test.js` — end-to-end release contract for fourteen pairs and immutable V4.
- Modify `package.json` — focused comparison test and coverage commands.
- Modify `pixverse-api-jobs/revolve-pdp/review-page-qa.json` — final comparison-specific browser QA evidence.

---

### Task 1: Define and Validate the Matched Comparison Catalog

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/data-model.js`
- Modify: `deploy/brand-pitches/revolve/pdp-review/catalog.json`
- Create: `test/unit/revolve-pdp-comparison-data-model.test.js`
- Modify: `test/revolve-pdp-review-release.test.js`

**Interfaces:**
- Consumes: existing v1 `catalog.json`, `deploy/brand-pitches/revolve/v4/index.html`, `pixverse-api-jobs/revolve-pdp/campaign.json`, `pixverse-api-jobs/revolve-pdp/standard-high-batch-results.json`, and `pixverse-api-jobs/revolve-pdp/comparisons/lior-wd140-standard-high/qa.json`.
- Produces: `validateComparisonCatalog(input): Readonly<ComparisonCatalog>`, `isSafePublicUrl(value, kind): boolean`, `SOURCE_KEYS`, `REVIEW_CHOICES`, and catalog schema `revolve-pdp-review.v2`.

- [ ] **Step 1: Write failing catalog-model tests**

Create `test/unit/revolve-pdp-comparison-data-model.test.js` with tests that:

```js
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  REVIEW_CHOICES,
  SOURCE_KEYS,
  isSafePublicUrl,
  validateComparisonCatalog,
} from "../../deploy/brand-pitches/revolve/pdp-review/data-model.js";

const catalogUrl = new URL(
  "../../deploy/brand-pitches/revolve/pdp-review/catalog.json",
  import.meta.url,
);

const fixture = async () => JSON.parse(await fs.readFile(catalogUrl, "utf8"));

test("catalog validates without mutating input", async () => {
  const input = await fixture();
  const before = structuredClone(input);
  const result = validateComparisonCatalog(input);

  assert.deepEqual(input, before);
  assert.notEqual(result, input);
  assert.ok(Object.isFrozen(result));
  assert.equal(result.products.length, 14);
  assert.deepEqual(SOURCE_KEYS, ["original0911", "pdpStandardHigh"]);
  assert.deepEqual(REVIEW_CHOICES, ["prefer-a", "prefer-b", "tie", "needs-review"]);
});

test("catalog rejects duplicate SKUs and incomplete source pairs", async () => {
  const duplicate = await fixture();
  duplicate.products[1].id = duplicate.products[0].id;
  assert.throws(() => validateComparisonCatalog(duplicate), /Duplicate product id/);

  const incomplete = await fixture();
  delete incomplete.products[0].sources.original0911;
  assert.throws(() => validateComparisonCatalog(incomplete), /original0911/);
});

test("catalog rejects unsafe or mislabeled media URLs", async () => {
  const unsafe = await fixture();
  unsafe.products[0].sources.original0911.videoUrl = "javascript:alert(1)";
  assert.throws(() => validateComparisonCatalog(unsafe), /videoUrl/);

  assert.equal(isSafePublicUrl("https://media.pixverse.ai/upload%2Fclip.mp4", "video"), true);
  assert.equal(isSafePublicUrl("https://www.revolve.com/item/dp/SKU/", "product"), true);
  assert.equal(isSafePublicUrl("https://example.com/clip.mp4", "video"), false);
  assert.equal(isSafePublicUrl("//media.pixverse.ai/clip.mp4", "video"), false);
});
```

Also cover wrong schema version, wrong product count, blank text, out-of-order or non-integer `order`, unsafe poster paths, extra query/hash credentials, missing source labels, and unknown top-level properties.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
node --test test/unit/revolve-pdp-comparison-data-model.test.js
```

Expected: FAIL because `data-model.js` does not exist and the catalog is still v1.

- [ ] **Step 3: Implement the immutable data-model boundary**

Create `data-model.js` with these exact exports and rules:

```js
export const SOURCE_KEYS = Object.freeze(["original0911", "pdpStandardHigh"]);
export const REVIEW_CHOICES = Object.freeze([
  "prefer-a",
  "prefer-b",
  "tie",
  "needs-review",
]);

export function isSafePublicUrl(value, kind) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return false;
  if (kind === "poster") {
    return /^\.\/assets\/posters\/(?:0911\/)?[A-Z0-9-]+\.jpg$/.test(value);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return false;
    if (kind === "video") return url.hostname === "media.pixverse.ai" && url.pathname.endsWith(".mp4");
    return kind === "product" && url.hostname === "www.revolve.com" && url.pathname.includes("/dp/");
  } catch {
    return false;
  }
}

export function validateComparisonCatalog(input) {
  // Validate the exact v2 shape, fourteen ordered unique products, both source
  // records, fixed labels, safe URLs, and local poster paths. Return a deeply
  // cloned and deeply frozen value; never mutate input.
}
```

Implement `deepFreeze` and small assertion helpers in the same file. Reject unknown source keys and enforce labels `A — 0911 Original` and `B — PDP Standard/high` so presentation copy cannot drift from the source mapping.

- [ ] **Step 4: Upgrade the catalog to v2 with exact A/B sources**

Keep every existing product field and move each current PDP URL/poster under `sources.pdpStandardHigh`. Add `sources.original0911` from the immutable V4 release. Use this exact 0911 URL map:

```text
SDYS-WD257  https://media.pixverse.ai/upload%2F9f2dd7a8-d87a-48fd-b12e-e504fa25ac33.mp4
COEL-WK115  https://media.pixverse.ai/upload%2Fefc3c9e0-795f-49d7-b12f-b441bd0c0644.mp4
PCHR-WS7    https://media.pixverse.ai/upload%2F8b39670e-3820-4f2f-a4be-e38945ca9615.mp4
LIOR-WD140  https://media.pixverse.ai/upload%2F777b564a-8390-4bb0-9b40-8fe679879d9f.mp4
BARD-WS308  https://media.pixverse.ai/upload%2Fc69563f6-a367-4ef5-b463-26be6860b046.mp4
HELO-WD29   https://media.pixverse.ai/upload%2Fd0ea2b08-020e-4670-9658-f17db05fe35b.mp4
SPDW-WP244  https://media.pixverse.ai/upload%2Fcbb80fc9-3912-4bd8-a3fe-294da8469fdd.mp4
LIOR-WD229  https://media.pixverse.ai/upload%2F7c6e7618-71f6-4c04-afcb-7a1de2f5bfe5.mp4
LEIV-WO65   https://media.pixverse.ai/upload%2Fd557ed99-396a-415f-ba73-4f487baf2624.mp4
HELO-WD5    https://media.pixverse.ai/upload%2F44bdf002-1730-47f9-9e3b-9ad7f4fd3452.mp4
HELO-WD27   https://media.pixverse.ai/upload%2F28c627fd-12ac-4cd2-9a7a-8d06dc2f609d.mp4
AAYR-WO4    https://media.pixverse.ai/upload%2F22b7b7fa-ca86-4eb5-8bc5-a1bafc66053e.mp4
AAYR-WD195  https://media.pixverse.ai/upload%2F3f92268d-13f0-4237-9e84-2a6439fcbb6b.mp4
LIOR-WS152  https://media.pixverse.ai/upload%2F2ad879aa-5754-495b-bc90-211193b5898f.mp4
```

Each product uses this source structure:

```json
{
  "sources": {
    "original0911": {
      "label": "A — 0911 Original",
      "videoUrl": "https://media.pixverse.ai/upload%2F…mp4",
      "poster": "./assets/posters/0911/SDYS-WD257.jpg"
    },
    "pdpStandardHigh": {
      "label": "B — PDP Standard/high",
      "videoUrl": "https://media.pixverse.ai/pixverse/mp4/media/workflow-studio/…mp4",
      "poster": "./assets/posters/SDYS-WD257.jpg"
    }
  }
}
```

- [ ] **Step 5: Update the release contract to bind both source sets**

Change the first release test to assert schema v2 and both sources. Extract the fourteen V4 URLs in display order and compare them to `sources.original0911.videoUrl`; continue comparing `sources.pdpStandardHigh.videoUrl` to the batch artifacts, including the special LIOR-WD140 Standard/high result.

```js
const originalUrls = [...v4Html.matchAll(/<video src="([^"]+)"/g)].map((match) => match[1]);
assert.equal(originalUrls.length, 14);
assert.deepEqual(
  catalog.products.map(({ sources }) => sources.original0911.videoUrl),
  originalUrls,
);
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --test test/unit/revolve-pdp-comparison-data-model.test.js test/revolve-pdp-review-release.test.js
```

Expected: all listed tests PASS. At this stage, preserve the existing fourteen-player HTML assertions and update only catalog-dependent expressions such as `product.videoUrl` to `product.sources.pdpStandardHigh.videoUrl`; Task 4 changes the rendered-player contract.

- [ ] **Step 7: Commit the catalog boundary**

```bash
git --git-dir=.git --work-tree=. add deploy/brand-pitches/revolve/pdp-review/catalog.json deploy/brand-pitches/revolve/pdp-review/data-model.js test/unit/revolve-pdp-comparison-data-model.test.js test/revolve-pdp-review-release.test.js
git --git-dir=.git --work-tree=. commit -m "feat: add REVOLVE PDP comparison catalog"
```

---

### Task 2: Add Immutable Local Review State

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/review-store.js`
- Create: `test/unit/revolve-pdp-review-store.test.js`

**Interfaces:**
- Consumes: `REVIEW_CHOICES` from `data-model.js`, a storage-like object with `getItem(key)` and `setItem(key, value)`, and the fourteen valid SKU strings.
- Produces: `createReviewStore({ storage, productIds, key }): ReviewStore`, where `ReviewStore` exposes `get(productId)`, `set(productId, choice)`, `snapshot()`, and `reviewedCount()`.

- [ ] **Step 1: Write failing store tests**

Create tests for immutable updates, refresh persistence, invalid SKU/choice rejection, corrupt JSON recovery, and storage exceptions:

```js
test("set returns a new frozen snapshot and persists only allowed choices", () => {
  const storage = createMemoryStorage();
  const store = createReviewStore({ storage, productIds: ["A", "B"], key: "test" });
  const before = store.snapshot();
  const after = store.set("A", "prefer-b");

  assert.deepEqual(before, {});
  assert.deepEqual(after, { A: "prefer-b" });
  assert.ok(Object.isFrozen(after));
  assert.equal(store.reviewedCount(), 1);
  assert.deepEqual(JSON.parse(storage.getItem("test")), { A: "prefer-b" });
});

test("storage failure falls back to in-memory state", () => {
  const storage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  const store = createReviewStore({ storage, productIds: ["A"], key: "test" });
  assert.deepEqual(store.set("A", "tie"), { A: "tie" });
  assert.equal(store.get("A"), "tie");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run `node --test test/unit/revolve-pdp-review-store.test.js`.

Expected: FAIL because `review-store.js` does not exist.

- [ ] **Step 3: Implement the store without mutating snapshots**

Use a closure-held frozen object. Parse stored JSON once, keep only known product IDs whose values occur in `REVIEW_CHOICES`, and replace state with `Object.freeze({ ...state, [productId]: choice })` on every valid write. Catch storage read/write failures and retain the in-memory state. Do not store reviewer identity, timestamps, notes, or analytics data.

Use the production key `revolve-pdp-review.preferences.v2` from `app.js`; tests inject `test`.

- [ ] **Step 4: Run tests and verify GREEN**

Run `node --test test/unit/revolve-pdp-review-store.test.js`.

Expected: all review-store tests PASS.

- [ ] **Step 5: Commit review state**

```bash
git --git-dir=.git --work-tree=. add deploy/brand-pitches/revolve/pdp-review/review-store.js test/unit/revolve-pdp-review-store.test.js
git --git-dir=.git --work-tree=. commit -m "feat: persist local PDP comparison choices"
```

---

### Task 3: Build Pair Playback and Active-Pair Coordination

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/pair-controller.js`
- Create: `test/unit/revolve-pdp-pair-controller.test.js`

**Interfaces:**
- Consumes: two video-like objects with `currentTime`, `muted`, `paused`, `play()`, and `pause()`; a page-level coordinator; and `onStatus(status)`.
- Produces: `createPlaybackCoordinator()`, and `createPairController({ id, videos, coordinator, onStatus })` exposing `playBoth()`, `pauseBoth()`, `restartBoth()`, `setAudioMode(mode)`, `markFailed(sourceKey)`, and `destroy()`.

- [ ] **Step 1: Write failing controller tests using video fakes**

Use a fake that records `play` and `pause` calls and can reject `play()`:

```js
test("play aligns to the earlier timestamp and starts both muted", async () => {
  const a = createVideoFake({ currentTime: 5.2 });
  const b = createVideoFake({ currentTime: 3.1 });
  const controller = createPairController({
    id: "SKU",
    videos: { original0911: a, pdpStandardHigh: b },
    coordinator: createPlaybackCoordinator(),
    onStatus() {},
  });

  assert.equal(await controller.playBoth(), true);
  assert.equal(a.currentTime, 3.1);
  assert.equal(b.currentTime, 3.1);
  assert.equal(a.muted, true);
  assert.equal(b.muted, true);
  assert.equal(a.playCalls, 1);
  assert.equal(b.playCalls, 1);
});

test("starting another pair pauses the active pair", async () => {
  const coordinator = createPlaybackCoordinator();
  const first = createControllerFixture("one", coordinator);
  const second = createControllerFixture("two", coordinator);
  await first.controller.playBoth();
  await second.controller.playBoth();
  assert.equal(first.a.pauseCalls, 1);
  assert.equal(first.b.pauseCalls, 1);
});
```

Also test exclusive `muted`/`original0911`/`pdpStandardHigh` audio, restart-to-zero while paused, one-side failure disabling shared play, rejected `play()` pausing both and returning `false`, and `destroy()` unregistering the pair.

- [ ] **Step 2: Run tests and verify RED**

Run `node --test test/unit/revolve-pdp-pair-controller.test.js`.

Expected: FAIL because `pair-controller.js` does not exist.

- [ ] **Step 3: Implement the coordinator and pair controller**

The coordinator holds only the current immutable `{ id, pause }` registration. `activate(id, pause)` pauses the previous registration when its ID differs, then replaces it. `release(id)` clears only the matching registration.

`playBoth()` must:

1. Return `false` and emit `{ type: "error", message: "Shared playback unavailable. Use the individual video controls." }` if either source is marked failed.
2. Activate the pair with the coordinator.
3. Align both `currentTime` values to `Math.min(a.currentTime, b.currentTime)`.
4. Apply the selected audio mode; default to both muted.
5. Await `Promise.all([a.play(), b.play()])`.
6. On rejection, pause both, release the coordinator, emit the same concise error, and return `false`.
7. On success, emit `{ type: "playing" }` and return `true`.

Do not alter `playbackRate` and do not run a drift-correction loop.

- [ ] **Step 4: Run tests and verify GREEN**

Run `node --test test/unit/revolve-pdp-pair-controller.test.js`.

Expected: all pair-controller tests PASS.

- [ ] **Step 5: Commit playback behavior**

```bash
git --git-dir=.git --work-tree=. add deploy/brand-pitches/revolve/pdp-review/pair-controller.js test/unit/revolve-pdp-pair-controller.test.js
git --git-dir=.git --work-tree=. commit -m "feat: coordinate PDP comparison playback"
```

---

### Task 4: Render the Accessible A/B Review Experience

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/render.js`
- Create: `test/unit/revolve-pdp-render.test.js`
- Modify: `deploy/brand-pitches/revolve/pdp-review/index.html`
- Modify: `deploy/brand-pitches/revolve/pdp-review/styles.css`
- Modify: `deploy/brand-pitches/revolve/pdp-review/app.js`
- Modify: `test/revolve-pdp-review-release.test.js`

**Interfaces:**
- Consumes: validated v2 catalog, `createReviewStore`, `createPairController`, `createPlaybackCoordinator`, browser `document`, `localStorage`, and `IntersectionObserver`.
- Produces: `escapeHtml(value)`, `renderComparisonRows(catalog)`, fourteen `.comparison-row` articles, twenty-eight videos, fourteen review radio groups, review progress, product jump behavior, and lazy poster loading.

- [ ] **Step 1: Write failing renderer tests**

Create `test/unit/revolve-pdp-render.test.js` and assert:

```js
test("renderer emits fourteen semantic rows and equal A/B players", async () => {
  const catalog = validateComparisonCatalog(await fixture());
  const html = renderComparisonRows(catalog);

  assert.equal((html.match(/class="comparison-row"/g) ?? []).length, 14);
  assert.equal((html.match(/<video\b/g) ?? []).length, 28);
  assert.equal((html.match(/<fieldset\b/g) ?? []).length, 14);
  assert.equal((html.match(/A — 0911 Original/g) ?? []).length, 14);
  assert.equal((html.match(/B — PDP Standard\/high/g) ?? []).length, 14);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 28);
});

test("renderer escapes product text and keeps validated URLs quoted", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});
```

Also assert unique row IDs, source-specific `aria-label` values, four radio values per SKU, direct links for A and B, `data-poster` rather than eager `poster` on deferred items, and no inline event handlers.

- [ ] **Step 2: Run renderer tests and verify RED**

Run `node --test test/unit/revolve-pdp-render.test.js`.

Expected: FAIL because `render.js` does not exist.

- [ ] **Step 3: Implement escaped semantic markup**

Implement `escapeHtml` for `&`, `<`, `>`, `"`, and `'`. `renderComparisonRows` receives only validated data and returns markup with:

- `<article class="comparison-row" id="product-SKU" data-product-id="SKU">`
- A shared product heading and metadata.
- Two `.source-panel` sections with persistent source label, identical `.media-frame`, native controls, `playsinline`, `preload="none"`, and `data-poster`.
- Shared buttons with `data-action="play-both"`, `pause-both`, and `restart-both`.
- An audio radio group with `muted`, `original0911`, and `pdpStandardHigh`.
- A review `<fieldset>` containing the four allowed choices.
- Direct A/B links and one canonical product link.
- A pair-local status element with `role="status"`.

All text and attribute values pass through `escapeHtml`, even though the catalog has already been validated.

- [ ] **Step 4: Replace the gallery shell with the comparison shell**

Update `index.html` to retain the brand assets, canonical URL, no-index metadata, and skip link. Replace hard-coded cards with:

```html
<header class="topbar">…<span id="review-progress" aria-live="polite">0 of 14 reviewed</span></header>
<main id="main">
  <section class="review-intro" aria-labelledby="review-title">…</section>
  <section class="comparison-review" aria-labelledby="comparison-title">
    <div class="comparison-toolbar">
      <div class="source-legend" aria-label="Comparison sources">…</div>
      <label>Jump to product <select id="product-jump"></select></label>
    </div>
    <div id="page-status" role="status" aria-live="polite"></div>
    <div id="comparison-list"></div>
  </section>
</main>
<script type="module" src="./app.js"></script>
```

Use page title `REVOLVE × PixVerse | 0911 vs PDP Review` and describe the four review criteria without making a winner claim.

- [ ] **Step 5: Implement browser orchestration in `app.js`**

`app.js` must:

1. Fetch `./catalog.json` with `{ cache: "no-store" }`.
2. Validate through `validateComparisonCatalog` before rendering.
3. Populate `#comparison-list` with `renderComparisonRows(catalog)` and the product jump options using DOM-created `<option>` elements.
4. Create one review store with key `revolve-pdp-review.preferences.v2`, restore checked radios, and update `N of 14 reviewed` after each change.
5. Create one coordinator and one pair controller per row.
6. Use delegated click/change handlers to call the correct controller or store method.
7. Lazy-load two posters for the first desktop pair or one poster on mobile, then use `IntersectionObserver` for the rest; if unavailable, load all deferred posters.
8. Mark the correct controller side failed on video `error` and keep the other native player usable.
9. Pause all pairs on `pagehide`.
10. Catch catalog/bootstrap failure and replace `#page-status` with `Comparison unavailable. Verify the local catalog and reload.` without rendering partial pairs.

Do not send review data over the network and do not add third-party scripts.

- [ ] **Step 6: Rebuild the CSS around the comparison seam**

Use existing token values from the PixVerse design system and implement:

- 56px sticky black header with white-alpha divider.
- Compact intro no taller than needed to keep the first pair near the first desktop viewport.
- Sticky `.comparison-toolbar` below the header.
- `.comparison-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }`.
- A 1px white-alpha center seam on desktop and horizontal seam below 768px.
- Identical `.media-frame { aspect-ratio: 9 / 16; }` on both sides.
- `object-fit: contain` inline and fullscreen.
- Source labels, shared controls, audio selector, and review choices with explicit hover, focus, selected, and disabled states.
- Minimum 44px touch targets.
- Mobile A-then-B stacking at 767px and below.
- No horizontal overflow at 320px.
- No shadows, no decorative gradient, and no scroll-reveal animation.
- `prefers-reduced-motion` support.

- [ ] **Step 7: Update the rendered-page release assertions**

In `test/revolve-pdp-review-release.test.js`, replace the old gallery contract with assertions for the new title, fourteen `.comparison-row` articles, twenty-eight videos, fourteen fieldsets, fifty-six review-choice inputs, exact A/B labels, progress live region, product jump control, and both media URLs per product. Keep poster existence limited to the already-present PDP poster in this task; Task 5 adds and verifies the copied 0911 poster set.

- [ ] **Step 8: Run unit tests and syntax checks**

Run:

```bash
node --test test/unit/revolve-pdp-render.test.js test/unit/revolve-pdp-review-store.test.js test/unit/revolve-pdp-pair-controller.test.js
node --test test/revolve-pdp-review-release.test.js
node --check deploy/brand-pitches/revolve/pdp-review/app.js
node --check deploy/brand-pitches/revolve/pdp-review/render.js
```

Expected: all tests and syntax checks PASS.

- [ ] **Step 9: Commit the comparison UI**

```bash
git --git-dir=.git --work-tree=. add deploy/brand-pitches/revolve/pdp-review/index.html deploy/brand-pitches/revolve/pdp-review/styles.css deploy/brand-pitches/revolve/pdp-review/app.js deploy/brand-pitches/revolve/pdp-review/render.js test/unit/revolve-pdp-render.test.js test/revolve-pdp-review-release.test.js
git --git-dir=.git --work-tree=. commit -m "feat: build REVOLVE PDP comparison review"
```

---

### Task 5: Add Baseline Posters and Harden the Release Contract

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/assets/posters/0911/*.jpg`
- Modify: `test/revolve-pdp-review-release.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: fourteen approved posters from `deploy/brand-pitches/revolve/v4/assets/posters/`, fourteen existing PDP posters, the v2 catalog, and the rendered comparison shell.
- Produces: twenty-eight local poster assets, complete release-contract coverage, `npm run test:revolve-pdp-review`, and `npm run test:revolve-pdp-review:coverage`.

- [ ] **Step 1: Extend release tests before copying assets**

Update `test/revolve-pdp-review-release.test.js` to assert:

- Exactly fourteen products, twenty-eight sources, fourteen rows, twenty-eight videos, fourteen fieldsets, and fifty-six preference radio inputs.
- Every A and B URL appears once as a player and once as a direct link.
- Every poster resolves under the release root, is a regular JPEG file, and is larger than 10,000 bytes.
- Every original poster byte-matches its approved V4 source using SHA-256.
- Every video has `preload="none"`, `playsinline`, a source-specific `aria-label`, and `data-poster`.
- Page title, exact A/B labels, progress live region, product jump, noindex metadata, headers, and robots rules exist.
- CSS contains equal two-column comparison sizing, `object-fit: contain`, the mobile stack, visible focus rules, and no `object-fit: cover` or `box-shadow`.
- Deployable text contains no credentials, private paths, job IDs, prompts, wallet data, or generation pricing.
- The V4 index hash remains `f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948`.

- [ ] **Step 2: Run the release test and verify RED**

Run `node --test test/revolve-pdp-review-release.test.js`.

Expected: FAIL because the fourteen `assets/posters/0911/*.jpg` files do not exist and old gallery assertions have not all been replaced.

- [ ] **Step 3: Copy approved posters without touching V4**

Create `deploy/brand-pitches/revolve/pdp-review/assets/posters/0911/` and copy each of the fourteen exact SKU filenames from `deploy/brand-pitches/revolve/v4/assets/posters/`. Do not move, rename, or rewrite the source files. Confirm all fourteen destination hashes match their source hashes.

- [ ] **Step 4: Add focused scripts with 80% coverage gates**

Set these `package.json` scripts:

```json
{
  "test:revolve-pdp-review": "node --test test/unit/revolve-pdp-comparison-data-model.test.js test/unit/revolve-pdp-review-store.test.js test/unit/revolve-pdp-pair-controller.test.js test/unit/revolve-pdp-render.test.js test/revolve-pdp-review-release.test.js",
  "test:revolve-pdp-review:coverage": "c8 --check-coverage --lines 80 --branches 80 --functions 80 --statements 80 --include 'deploy/brand-pitches/revolve/pdp-review/data-model.js' --include 'deploy/brand-pitches/revolve/pdp-review/review-store.js' --include 'deploy/brand-pitches/revolve/pdp-review/pair-controller.js' --include 'deploy/brand-pitches/revolve/pdp-review/render.js' node --test test/unit/revolve-pdp-comparison-data-model.test.js test/unit/revolve-pdp-review-store.test.js test/unit/revolve-pdp-pair-controller.test.js test/unit/revolve-pdp-render.test.js"
}
```

- [ ] **Step 5: Run focused verification and reach GREEN**

Run:

```bash
npm run test:revolve-pdp-review
npm run test:revolve-pdp-review:coverage
```

Expected: all focused tests PASS and all four coverage thresholds are at least 80%.

- [ ] **Step 6: Commit assets and release gates**

```bash
git --git-dir=.git --work-tree=. add deploy/brand-pitches/revolve/pdp-review/assets/posters/0911 test/revolve-pdp-review-release.test.js package.json package-lock.json
git --git-dir=.git --work-tree=. commit -m "test: verify REVOLVE PDP comparison release"
```

If `package-lock.json` is unchanged, omit it from the add command.

---

### Task 6: Complete Browser E2E QA and Repository Verification

**Files:**
- Modify: `pixverse-api-jobs/revolve-pdp/review-page-qa.json`

**Interfaces:**
- Consumes: completed local comparison release and its existing local HTTP server.
- Produces: evidence-backed QA record; no deployment.

- [ ] **Step 1: Start or reuse the local review server**

Serve only the comparison release directory on an available localhost port. Reuse port `52833` if the existing process still serves the updated files; otherwise start a new bounded local server and record its port.

- [ ] **Step 2: Run desktop browser E2E checks**

At 1920×1080 and 1280×900 verify:

- Exactly fourteen rows and twenty-eight players render.
- A and B have equal computed width and `9:16` frames.
- The first comparison appears near the initial viewport.
- Shared play starts both; pause stops both; restart returns both to zero.
- Selecting A audio mutes B, selecting B mutes A, and Muted mutes both.
- Starting a second product pauses the first pair.
- Selecting `Prefer B` increments progress and survives reload.
- Product jump scrolls to the selected SKU without hiding other rows.
- Only the first pair's two posters are requested initially; all twenty-eight appear after a full scroll.
- There is no horizontal overflow or console error.

- [ ] **Step 3: Run mobile browser E2E checks**

At 375×812 and 320×700 verify:

- Each product stacks A then B with explicit labels.
- The desktop seam becomes a horizontal divider.
- One poster is requested initially and the rest load near viewport entry.
- Shared controls and all radio choices remain at least 44px tall, keyboard-focusable, and non-overlapping.
- Long product names wrap cleanly.
- Native fullscreen retains `object-fit: contain`.
- No horizontal overflow or console error occurs.

- [ ] **Step 4: Exercise failure and privacy behavior**

Using browser-local request blocking or a temporary in-memory override, verify that one failed source shows its inline failure state while the other remains usable and the direct link remains present. Block browser storage and verify review choices still work for the current session. Restore normal browser state without editing the catalog.

Confirm the page sends no review submission, analytics, cookie, or third-party script request.

- [ ] **Step 5: Update the QA evidence immutably**

Replace the old single-gallery metrics in `review-page-qa.json` with comparison-specific fields:

```json
{
  "release_root": "deploy/brand-pitches/revolve/pdp-review",
  "canonical_url": "https://revolve-pdp-review.pages.dev/",
  "publication_status": "local-only",
  "products": 14,
  "comparison_rows": 14,
  "videos_verified": 28,
  "posters_verified": 28,
  "desktop_viewports": ["1920x1080", "1280x900"],
  "mobile_viewports": ["375x812", "320x700"],
  "initial_poster_requests": { "desktop": 2, "mobile": 1 },
  "posters_after_full_scroll": 28,
  "shared_playback": "passed",
  "exclusive_audio": "passed",
  "local_review_persistence": "passed",
  "single_source_failure": "passed",
  "horizontal_overflow": false,
  "console_errors": 0,
  "v4_sha256": "f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948",
  "result": "passed"
}
```

- [ ] **Step 6: Run the complete local verification suite**

Run:

```bash
npm run test:revolve-pdp-review
npm run test:revolve-pdp-review:coverage
npm run test:api
npm run test:pitches
npm run check
GIT_DIR=.git GIT_WORK_TREE=. npm run security:scan
git --git-dir=.git --work-tree=. diff --check
```

Expected: every command PASS, no secret finding, no whitespace error, and V4 hash unchanged. If the repository-wide pitch suite exposes an unrelated pre-existing failure, record the exact failing test separately and do not weaken its assertion.

- [ ] **Step 7: Review the final diff and commit QA evidence**

Run:

```bash
git --git-dir=.git --work-tree=. status --short
git --git-dir=.git --work-tree=. diff --stat ec9a537..HEAD
git --git-dir=.git --work-tree=. diff --check
```

Confirm only the planned comparison files and QA record changed. Then commit:

```bash
git --git-dir=.git --work-tree=. add pixverse-api-jobs/revolve-pdp/review-page-qa.json
git --git-dir=.git --work-tree=. commit -m "test: record REVOLVE PDP comparison QA"
```

- [ ] **Step 8: Stop before deployment**

Report the local URL, test results, coverage, V4 hash, commits, and the fact that publication remains pending. Do not create or update a Cloudflare Pages project and do not push unless the user separately requests it.
