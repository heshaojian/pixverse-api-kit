# VIPS Complete Product Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the VIPS pitch visibly present three complete video-and-product examples together, then list all 28 reviewed product cases—including products whose videos will be added later—without weakening the existing evidence ledger or verified-link rules.

**Architecture:** Keep the page as a static, Chinese-first pitch backed by the reviewed `cases.json` corpus. Add one immutable catalog selector to `data-model.js`, render the 28 lightweight product cards from that selector, and retain the full 29-record evidence ledger separately because its prompt-only baseline is evidence rather than a product. Move the existing hero proof into the featured section so all three proofs share one semantic structure, while CSS respects each source video's real aspect ratio.

**Tech Stack:** Semantic HTML, CSS, browser-native JavaScript modules, Node.js test runner, `c8` coverage, local static-server/browser review.

**Spec:** `docs/superpowers/specs/2026-09-20-vips-complete-product-gallery-design.md`

---

## Scope and invariants

- The featured section contains exactly three `.featured-case` articles. Every article contains its own video and adjacent product information.
- Featured source ratios stay truthful: product motion `720×1280`, presenter `768×1344`, creative commercial `1280×720`. Use `object-fit: contain`; do not crop the product or force the landscape clip into a portrait frame.
- The product gallery contains exactly 28 reviewed product cases, grouped in the original five chapter order.
- Exclude only `product-motion-prompt-baseline` from the product gallery. Keep it in the 29-record evidence ledger.
- Keep the five product cases without reviewed video visible:
  `viral-remix-apparel-03`, `viral-remix-price-sync`, `outfit-gray-windbreaker`, `outfit-plaid-shirt`, and `outfit-green-casual-pants`.
- Product links remain strict reviewed evidence: 10 case mappings and 9 unique `detail.vip.com` URLs. Never infer or invent a missing product URL.
- The 28-card gallery is a lightweight inventory/navigation surface. It may show one lazy image or a placeholder, but it must not create 28 eager video players.
- No paid generation, public deployment, or unrelated REVOLVE repair is part of this change.

## Task 1: Add the immutable 28-product catalog selector

**Files:**
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js`
- Modify: `test/unit/vips-pitch-data-model.test.js`
- Create: `test/fixtures/vips-product-catalog.json`

- [x] **Step 1: Create the reviewed product-order fixture**

Add a compact fixture with the 28 expected case IDs in chapter order and the five expected no-video case IDs. This makes accidental corpus drift visible without duplicating customer-facing copy.

```json
{
  "excludedCaseId": "product-motion-prompt-baseline",
  "caseIds": [
    "viral-remix-apparel-01",
    "viral-remix-apparel-02",
    "viral-remix-apparel-03",
    "viral-remix-slim-jeans",
    "viral-remix-price-sync",
    "edit-replace-shoes",
    "edit-replace-shirt",
    "edit-background-skincare",
    "edit-background-apparel",
    "edit-man-to-woman",
    "edit-woman-to-man",
    "presenter-sport-jacket",
    "presenter-mens-jeans",
    "presenter-womens-tshirt",
    "creative-cyber-sneaker",
    "creative-skincare-ice",
    "creative-french-beauty-gift",
    "product-motion-polka-dot",
    "product-motion-black-sweatshirt",
    "product-motion-gift-sweatshirt",
    "product-motion-brown-skirt",
    "product-motion-light-dress",
    "product-motion-multi-pose",
    "product-motion-black-coat",
    "product-motion-sport-top",
    "outfit-gray-windbreaker",
    "outfit-plaid-shirt",
    "outfit-green-casual-pants"
  ],
  "noVideoCaseIds": [
    "viral-remix-apparel-03",
    "viral-remix-price-sync",
    "outfit-gray-windbreaker",
    "outfit-plaid-shirt",
    "outfit-green-casual-pants"
  ]
}
```

- [x] **Step 2: Write the failing selector tests**

Import `getProductCatalogRecords` and assert exact order, count, immutability, exclusion, evidence anchors, statuses, and verified-link preservation.

```js
test("product catalog preserves all 28 reviewed products in source order", async () => {
  const fixture = await readFixture();
  const expected = JSON.parse(await fs.readFile(catalogFixturePath, "utf8"));
  const records = getProductCatalogRecords(fixture);

  assert.equal(records.length, 28);
  assert.deepEqual(records.map(({ caseId }) => caseId), expected.caseIds);
  assert.ok(!records.some(({ caseId }) => caseId === expected.excludedCaseId));
  assert.ok(Object.isFrozen(records));
  assert.ok(records.every(Object.isFrozen));
  assert.deepEqual(flattenCases(fixture).map(({ id }) => id).includes(expected.excludedCaseId), true);
});

test("product catalog retains products whose videos are pending", async () => {
  const expected = JSON.parse(await fs.readFile(catalogFixturePath, "utf8"));
  const records = getProductCatalogRecords(await readFixture());
  const pending = records.filter(({ mediaStatus }) => mediaStatus !== "已有视频");

  assert.deepEqual(pending.map(({ caseId }) => caseId), expected.noVideoCaseIds);
  assert.ok(pending.every(({ evidenceHref }) => evidenceHref.startsWith("#")));
});
```

- [x] **Step 3: Run the model test and confirm RED**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js
```

Expected: FAIL because `getProductCatalogRecords` is not exported.

- [x] **Step 4: Implement deterministic catalog derivation**

Add small pure helpers for representative media and media status. Prefer the first input image, then the first reviewed attempt image for `previewImage`; determine `hasVideo` from attempt media; derive the product URL only from an input of type `link`.

```js
const PRODUCT_CATALOG_EXCLUSIONS = new Set(["product-motion-prompt-baseline"]);

export function getProductCatalogRecords(data) {
  const validated = validatePitchData(data);
  return Object.freeze(validated.chapters.flatMap((chapter) => chapter.cases
    .filter(({ id }) => !PRODUCT_CATALOG_EXCLUSIONS.has(id))
    .map((record) => Object.freeze({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      caseId: record.id,
      caseTitle: record.title,
      verdict: record.review.verdict,
      mediaStatus: getCatalogMediaStatus(record),
      previewImage: findCatalogPreviewImage(record),
      productUrl: record.inputs.find(({ type }) => type === "link")?.url ?? null,
      evidenceHref: `#${record.id}`,
    }))));
}
```

The returned array, each record, and any exposed preview object must be frozen or copied into a frozen object. Do not mutate validated source objects.

- [x] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js
```

Expected: PASS, including the existing 29-record ledger and 10-link provenance tests.

- [x] **Step 6: Commit the model increment**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js test/unit/vips-pitch-data-model.test.js test/fixtures/vips-product-catalog.json
git commit -m "feat: model complete VIPS product catalog"
```

## Task 2: Render all 28 products as grouped lightweight cards

**Files:**
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`
- Modify: `test/unit/vips-pitch-render.test.js`

- [x] **Step 1: Replace the ten-link renderer test with failing complete-gallery tests**

Import and exercise `renderProductCatalog`.

```js
test("product catalog renders all 28 reviewed products in five source groups", async () => {
  const html = renderProductCatalog(await readFixture());

  assert.equal((html.match(/class="product-catalog-card/g) ?? []).length, 28);
  assert.equal((html.match(/class="product-catalog-group/g) ?? []).length, 5);
  assert.doesNotMatch(html, /product-motion-prompt-baseline/);
  assert.doesNotMatch(html, /<video\b/);
});

test("product catalog keeps pending products and strict product links", async () => {
  const html = renderProductCatalog(await readFixture());
  const productUrls = [...html.matchAll(/href="(https:\/\/detail\.vip\.com\/[^"]+)"/g)]
    .map(([, url]) => url);

  assert.equal((html.match(/class="product-catalog-link/g) ?? []).length, 10);
  assert.equal(new Set(productUrls).size, 9);
  assert.equal((html.match(/class="product-evidence-link/g) ?? []).length, 28);
  assert.match(html, /已有图片，视频待补充|视频待补充/);
});
```

Also retain the existing escaping and `noreferrer` assertions so catalog metadata is treated as untrusted input.

- [x] **Step 2: Run the renderer test and confirm RED**

Run:

```bash
node --test test/unit/vips-pitch-render.test.js
```

Expected: FAIL because `renderProductCatalog` does not exist.

- [x] **Step 3: Implement grouped catalog markup**

Replace `getProductLinkRecords` with `getProductCatalogRecords` in the catalog path. Keep the reusable strict `renderProductLink` helper. Render one semantic section per chapter and one article per product.

```js
export function renderProductCatalog(data) {
  const records = getProductCatalogRecords(data);
  const groups = groupCatalogRecords(records);
  return [
    `<div class="product-catalog" data-product-count="${records.length}">`,
    groups.map(renderProductCatalogGroup).join(""),
    `</div>`,
  ].join("");
}
```

Each `.product-catalog-card` must contain:

- Product title and source workflow.
- Non-color verdict text/symbol from `renderVerdict`.
- One of `已有视频`, `已有图片，视频待补充`, or `视频待补充`.
- A lazy preview image when `previewImage` exists; otherwise an explicit neutral placeholder.
- `查看完整评审` linking to the exact case disclosure.
- `查看唯品会商品详情` only when the reviewed product URL exists.

Keep `renderProductDirectory` as a temporary one-line compatibility wrapper returning
`renderProductCatalog(data)` so this intermediate commit does not break `app.js`. Remove
the wrapper when the app import and mount are changed atomically in Task 4.

- [x] **Step 4: Run renderer and coverage tests**

Run:

```bash
node --test test/unit/vips-pitch-render.test.js
npm run test:vips-pitch:coverage
```

Expected: PASS with at least 80% lines, branches, functions, and statements for `data-model.js` and `render.js`.

- [x] **Step 5: Commit the renderer increment**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js test/unit/vips-pitch-render.test.js
git commit -m "feat: render complete VIPS product catalog"
```

## Task 3: Put all three complete proof cards in the featured section

**Files:**
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`
- Modify: `test/vips-pitch-page.test.js`

- [x] **Step 1: Rewrite the static page assertions first**

Replace the old “two featured cards plus one hero proof” assertions with structural checks for three self-contained cards.

```js
assert.equal((html.match(/<article class="featured-case[^"]*"/g) ?? []).length, 3);
assert.doesNotMatch(html, /class="hero-proof"/);
assert.equal((html.match(/class="featured-product-info"/g) ?? []).length, 3);
assert.equal((html.match(/<video\b/g) ?? []).length, 3);
assert.match(html, /先看三条最能代表业务价值的商品视频/);
```

Add targeted assertions that every featured article contains exactly one video before its closing tag, that the creative card retains the exact verified VIPS URL, and that only that card exposes a product link.

- [x] **Step 2: Run the page test and confirm RED**

Run:

```bash
node --test test/vips-pitch-page.test.js
```

Expected: FAIL on the old `hero-proof` and two-card structure.

- [x] **Step 3: Simplify the hero and construct three featured articles**

Move the product-motion figure out of `.hero-layout` and make it the first featured article. Keep the hero’s customer proposition and CTA, but remove the visual proof that made the three-item claim misleading.

Featured order:

1. `featured-product-motion.mp4` — full-width lead, `720×1280`, title and reviewed summary together.
2. `featured-presenter.mp4` — supporting portrait, `768×1344`, title and reviewed summary together.
3. `featured-creative.mp4` — supporting landscape, `1280×720`, title, reviewed summary, and verified product link together.

Use a shared internal structure:

```html
<article class="featured-case featured-case-lead">
  <div class="featured-media featured-media-product">
    <video class="evidence-media" controls playsinline aria-label="浅黄绿西装多姿势商品动效评审视频"></video>
  </div>
  <div class="featured-product-info">
    <h3>浅黄绿西装多姿势商品动效</h3>
    <p>评审结论与商品信息。</p>
  </div>
</article>
```

Give the creative card `featured-media-landscape`. Keep `controls`, `playsinline`, accessible labels, and the current poster/preload policy. The featured section now truthfully contains all three items named by its heading.

- [x] **Step 4: Run the static page test and confirm GREEN**

Run:

```bash
node --test test/vips-pitch-page.test.js
```

Expected: PASS with exactly three featured cards and the existing catalog shell still intact.

- [x] **Step 5: Commit the semantic page structure**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html test/vips-pitch-page.test.js
git commit -m "feat: group three VIPS product video proofs"
```

## Task 4: Wire and style the complete catalog and real media ratios

**Files:**
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css`
- Modify: `test/vips-pitch-e2e.test.js`
- Modify: `test/vips-pitch-page.test.js`

- [ ] **Step 1: Add failing integration assertions**

Update the app/server test to require a rendered 28-product catalog rather than ten links.

```js
assert.match(pageHtml, /id="product-catalog-mount"/);
assert.equal((catalog.match(/class="product-catalog-card/g) ?? []).length, 28);
assert.equal((catalog.match(/class="product-evidence-link/g) ?? []).length, 28);
assert.equal((catalog.match(/class="product-catalog-link/g) ?? []).length, 10);
assert.doesNotMatch(catalog, /<video\b/);
```

Add CSS source assertions for a 16:9 landscape frame, portrait frames, `object-fit: contain`, and responsive catalog columns.

- [ ] **Step 2: Run page and E2E tests and confirm RED**

Run:

```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
```

Expected: FAIL because the app still imports `renderProductDirectory` and targets the old mount.

- [ ] **Step 3: Wire the new renderer without changing evidence-ledger behavior**

Keep the stable `#product-directory` navigation anchor, but change the visible title in
`index.html` to `全部评审商品`, explain that all 28 products are included, and rename the
mount to `#product-catalog-mount` with a matching loading state. In `app.js`, import
`renderProductCatalog`, find the renamed mount, and set its HTML after validated data
loads. Remove the temporary `renderProductDirectory` wrapper from `render.js` in this
same step. Keep the existing error message, deferred evidence loading, deep-link opening,
and pilot selector unchanged.

- [ ] **Step 4: Implement restrained, responsive featured and catalog styles**

Use the existing design tokens. Required behavior:

- Desktop: product-motion lead spans the featured grid; presenter and creative sit below.
- The two portrait videos use their intrinsic portrait ratio; the creative video uses `aspect-ratio: 16 / 9`.
- Every featured card’s `.featured-product-info` remains visually attached to its video.
- All videos use `width: 100%; height: 100%; object-fit: contain; background: #000;`.
- Catalog grid scales from four columns on wide desktop to three/two/one as space decreases.
- Cards remain flat and editorial: one border level, no nested floating-card treatment, no gradient decoration.
- Preview images reserve space and use `object-fit: contain`; missing previews use a labelled placeholder.
- Links and disclosure targets remain keyboard-visible and at least 44px tall where they act as primary controls.

Example ratio rules:

```css
.featured-media-product { aspect-ratio: 9 / 16; }
.featured-media-presenter { aspect-ratio: 4 / 7; }
.featured-media-landscape { aspect-ratio: 16 / 9; }
.featured-media .evidence-media { width: 100%; height: 100%; object-fit: contain; }
```

- [ ] **Step 5: Run focused integration and coverage tests**

Run:

```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
npm run test:vips-pitch:coverage
```

Expected: PASS. The fetched catalog contains 28 products; the full evidence ledger still contains 29 reviewed records.

- [ ] **Step 6: Commit the wired responsive experience**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
git commit -m "feat: complete VIPS product gallery experience"
```

## Task 5: Verify the shareable page end to end

**Files:**
- Modify only if a test gap is found: `test/vips-pitch-release.test.js`
- Modify only if a test gap is found: `test/vips-pitch-brand.test.js`
- Modify only if a test gap is found: `test/vips-pitch-data.test.js`

- [ ] **Step 1: Run all VIPS tests and required quality gates**

```bash
node --test test/vips-*.test.js test/unit/vips-pitch-*.test.js
npm run test:vips-pitch:coverage
npm run check
npm run security:scan
```

Expected: PASS with 80%+ focused coverage and no secret findings.

- [ ] **Step 2: Run the wider pitch suite and classify unrelated failures**

```bash
npm run test:pitches
```

Expected: VIPS tests pass. If the already-known unrelated REVOLVE asset failures remain, record them without modifying REVOLVE:

- `assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V1.jpg`
- `deploy/brand-pitches/revolve/v4/assets/posters/SDYS-WD257.jpg`

- [ ] **Step 3: Serve and inspect the page at four viewports**

Open the local page and review:

- `320×768`
- `768×1024`
- `1366×768`
- `1920×1080`

At each size verify:

- The headline says three and exactly three full featured cards are visible in the section.
- Each featured video remains attached to its own product information.
- The 16:9 creative clip has no forced portrait black-band container.
- `全部评审商品` reports and renders 28 cards across five groups.
- The five no-video products are visible with honest pending status.
- Product links appear only on the 10 verified mappings.
- Every product can navigate to its exact full-evidence record.
- No horizontal overflow, clipped text, broken poster, or keyboard focus loss.

- [ ] **Step 4: Review the final diff for scope and security**

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
git diff HEAD~4..HEAD -- deploy/brand-pitches/vips/human-reviewed-ecommerce test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js test/unit/vips-pitch-data-model.test.js test/unit/vips-pitch-render.test.js test/fixtures/vips-product-catalog.json
```

Confirm there are no credentials, invented claims, unverified product URLs, external scripts, unsafe URL handling regressions, or unrelated files.

- [ ] **Step 5: Add only necessary regression coverage and commit verification**

If browser review reveals a gap, first add the smallest failing automated test, then fix and rerun the focused suite. Finish with:

```bash
git add test/vips-pitch-release.test.js test/vips-pitch-brand.test.js test/vips-pitch-data.test.js deploy/brand-pitches/vips/human-reviewed-ecommerce
git commit -m "test: verify complete VIPS product gallery"
```

If no source change is needed after verification, do not create an empty commit.

## Definition of done

- The featured section itself contains exactly three video-and-product cards.
- The 28-product gallery is derived from the reviewed corpus and includes every original product case.
- The prompt-only baseline remains available in the 29-record full evidence ledger but is not misrepresented as a product.
- Pending-video products remain visible and clearly labelled.
- The real 9:16, 4:7, and 16:9 source formats display without crop or forced shared framing.
- The 10 verified product mappings and 9 unique VIPS destinations are unchanged.
- Focused tests and coverage, syntax checks, security scan, and four-viewport browser QA are complete.
- No public deployment or paid generation has occurred.
