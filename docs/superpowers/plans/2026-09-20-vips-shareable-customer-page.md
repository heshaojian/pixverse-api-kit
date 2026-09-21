# VIPS Shareable Customer Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing VIPS decision pitch into a private, customer-ready page with explicit co-branding, verified VIPS product-detail links, customer-facing copy, and measurable pilot criteria.

**Architecture:** Keep the existing static HTML plus progressive JavaScript enhancement. Extend the validated corpus with a safe product-link revision, derive immutable case-to-product records from existing case inputs, render the product directory and case links from that model, and keep the strongest featured proof static for no-JavaScript resilience. Store first-party brand assets locally with a checked provenance manifest; no customer token or Feishu URL enters the deploy artifact.

**Tech Stack:** Semantic HTML, CSS, native ES modules, Node.js test runner, local JSON, `curl`, `file`, `sips`, existing static HTTP integration tests.

**Spec:** `docs/superpowers/specs/2026-09-20-vips-shareable-customer-page-design.md`

## Global Constraints

- Publication mode remains private or access-controlled; do not deploy publicly.
- Keep all 29 cases, five chapters, reviewed verdicts, attempts, observations, and media unchanged.
- Product-link authority is Feishu document `L6sbdC5j3obuDoxrpcYcwGySn2e`, revision `5`; its token must not appear under `deploy/`.
- Exactly ten cases map to nine unique `https://detail.vip.com/` URLs; product-motion and outfit-generation receive no invented links.
- Use the first-party `https://www.vip.com/favicon.ico` as the VIPS identity icon; do not approximate a customer wordmark.
- Keep PixVerse v1.0.1 dark-only tokens, one create-gradient action, centered `contain` media, visible focus, reduced motion, and 44-pixel touch targets.
- Keep `noindex`, CSP, clickjacking, MIME, referrer, permissions, and private-proposal protections.
- Do not add analytics, cookies, tracking parameters, external JavaScript, paid generation, CRM submission, email delivery, or Feishu messaging.
- Preserve immutable transformations and at least 80% covered-module statements, branches, functions, and lines.

## File Structure

**Create:**

- `test/fixtures/vips-product-links.json` — repository-only revision-5 mapping authority.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/vips-icon.ico` — exact first-party VIPS favicon bytes.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/pixverse-touch-icon.png` — local 180×180 saved-page icon.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/brand-assets.json` — public-safe provenance and hashes for the two local brand assets.
- `test/vips-pitch-brand.test.js` — brand asset integrity and source-policy checks.

**Modify:**

- `deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json` — safe `productLinkRevisionId: 5` only.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js` — product URL validation and immutable record selectors.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js` — customer-facing product-link and directory rendering.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js` — mount the validated product directory with the ledger.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html` — co-brand shell, customer headline, featured link, metrics, share metadata.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css` — responsive co-brand, directory, product-link, and metric styling.
- `test/unit/vips-pitch-data-model.test.js` — source, URL, mapping, and immutability coverage.
- `test/unit/vips-pitch-render.test.js` — product link escaping and directory rendering.
- `test/vips-pitch-data.test.js` — fixture-to-corpus mapping verification.
- `test/vips-pitch-page.test.js` — customer-ready page story and static featured-link checks.
- `test/vips-pitch-e2e.test.js` — brand assets, directory mount, and static serving.
- `test/vips-pitch-release.test.js` — no Feishu token under deploy and brand manifest checks.

---

### Task 1: Lock Product-Link Provenance And Model

**Files:**

- Create: `test/fixtures/vips-product-links.json`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js`
- Modify: `test/unit/vips-pitch-data-model.test.js`
- Modify: `test/vips-pitch-data.test.js`

**Interfaces:**

- Consumes: existing `cases.json` chapter/case/input order.
- Produces: `isVerifiedProductUrl(value): boolean` and `getProductLinkRecords(data): ReadonlyArray<{ chapterId, chapterTitle, caseId, caseTitle, url }>`.

- [ ] **Step 1: Add the repository-only mapping fixture**

Create `test/fixtures/vips-product-links.json` with this exact shape and all ten case mappings extracted from revision 5:

```json
{
  "sourceDocumentId": "L6sbdC5j3obuDoxrpcYcwGySn2e",
  "revisionId": 5,
  "verifiedAt": "2026-09-20",
  "records": [
    { "caseId": "viral-remix-apparel-01", "url": "https://detail.vip.com/detail-0-6921774026741411905.html" },
    { "caseId": "viral-remix-apparel-02", "url": "https://detail.vip.com/detail-1710613224-6921386016684133277.html" },
    { "caseId": "viral-remix-apparel-03", "url": "https://detail.vip.com/detail-1710613848-6921852514308529026.html" },
    { "caseId": "viral-remix-slim-jeans", "url": "https://detail.vip.com/detail-1710613848-6921253477227005124.html" },
    { "caseId": "viral-remix-price-sync", "url": "https://detail.vip.com/detail-1710613848-6920924584846839178.html" },
    { "caseId": "edit-replace-shoes", "url": "https://detail.vip.com/detail-1710613224-6919766884650297994.html" },
    { "caseId": "edit-replace-shirt", "url": "https://detail.vip.com/detail-1710613848-6920924584846839178.html" },
    { "caseId": "creative-cyber-sneaker", "url": "https://detail.vip.com/detail-1710618487-6918720069182505559.html" },
    { "caseId": "creative-skincare-ice", "url": "https://detail.vip.com/detail-1711533687-6922097426018636437.html" },
    { "caseId": "creative-french-beauty-gift", "url": "https://detail.vip.com/detail-1711533687-6922097683692831559.html" }
  ]
}
```

- [ ] **Step 2: Write failing model and corpus tests**

Add tests that assert:

```js
assert.equal(data.source.productLinkRevisionId, 5);
assert.equal(isVerifiedProductUrl("https://detail.vip.com/detail-0-6921774026741411905.html"), true);
assert.equal(isVerifiedProductUrl("https://detail.vip.com/detail-0-6921774026741411905.html?track=1"), false);
assert.equal(isVerifiedProductUrl("https://example.com/detail-0-6921774026741411905.html"), false);

const links = getProductLinkRecords(data);
assert.equal(links.length, 10);
assert.equal(new Set(links.map(({ url }) => url)).size, 9);
assert.equal(Object.isFrozen(links), true);
assert.ok(links.every(Object.isFrozen));
assert.deepEqual(
  links.map(({ caseId, url }) => ({ caseId, url })),
  fixture.records,
);
```

Clone the corpus, replace one mapped URL with a query-bearing URL, and assert `validatePitchData` throws. Also assert the fixture's `sourceDocumentId` never occurs in serialized deploy data.

- [ ] **Step 3: Run tests and confirm RED**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js test/vips-pitch-data.test.js
```

Expected: FAIL because `productLinkRevisionId`, `isVerifiedProductUrl`, and `getProductLinkRecords` do not exist.

- [ ] **Step 4: Implement strict product URL validation and immutable extraction**

In `data-model.js`, add:

```js
export function isVerifiedProductUrl(value) {
  if (!isSafeMediaUrl(value) || !/^https:/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "detail.vip.com"
      && /^\/detail-[0-9]+-[0-9]+\.html$/.test(parsed.pathname)
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}

export function getProductLinkRecords(data) {
  const validated = validatePitchData(data);
  return Object.freeze(validated.chapters.flatMap((chapter) => chapter.cases.flatMap((record) =>
    record.inputs
      .filter(({ type }) => type === "link")
      .map(({ url }) => Object.freeze({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        caseId: record.id,
        caseTitle: record.title,
        url,
      }))
  )));
}
```

Require `data.source.productLinkRevisionId === 5`. During case validation, require every `type: "link"` input to pass `isVerifiedProductUrl`. Add only `"productLinkRevisionId": 5` to `cases.json`; do not add either Feishu document ID.

- [ ] **Step 5: Run tests and confirm GREEN**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js test/vips-pitch-data.test.js
```

Expected: all tests pass; ten mappings and nine unique URLs match the fixture exactly.

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/vips-product-links.json \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js \
  test/unit/vips-pitch-data-model.test.js test/vips-pitch-data.test.js
git commit -m "feat: verify VIPS product detail links"
```

---

### Task 2: Render Customer-Facing Product Links

**Files:**

- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js`
- Modify: `test/unit/vips-pitch-render.test.js`
- Modify: `test/vips-pitch-e2e.test.js`

**Interfaces:**

- Consumes: `getProductLinkRecords(data)` and validated case `type: "link"` inputs from Task 1.
- Produces: `renderProductDirectory(data): string`; case summaries expose an exact matching `detail.vip.com` link.

- [ ] **Step 1: Write failing render tests**

Add tests that assert:

```js
const html = renderProductDirectory(data);
assert.equal((html.match(/class="product-directory-link"/g) ?? []).length, 10);
assert.equal(new Set([...html.matchAll(/href="(https:\/\/detail\.vip\.com\/[^"]+)"/g)].map(([, url]) => url)).size, 9);
assert.match(html, /target="_blank" rel="noreferrer"/);
assert.doesNotMatch(html, /L6sbdC5j3obuDoxrpcYcwGySn2e|feishu\.cn/);

const caseHtml = renderCase(data.chapters[2].cases[1]);
assert.match(caseHtml, /查看唯品会商品详情/);
assert.ok(caseHtml.indexOf("查看唯品会商品详情") < caseHtml.indexOf("完整评审记录"));
```

Add a case without a link and assert its summary has no product-link anchor.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
node --test test/unit/vips-pitch-render.test.js
```

Expected: FAIL because `renderProductDirectory` is not exported and case summaries do not surface links.

- [ ] **Step 3: Implement safe case and directory rendering**

Import `getProductLinkRecords`. Add a helper that renders only a validated `type: "link"` input:

```js
const renderProductLink = ({ url, caseTitle }, className = "case-product-link") => [
  `<a class="${className}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noreferrer"`,
  ` aria-label="查看${escapeHtml(caseTitle)}的唯品会商品详情">`,
  `查看唯品会商品详情 <span aria-hidden="true">↗</span>`,
  `</a>`,
].join("");
```

In `renderCase`, place the link after the review summary and before representative evidence. Implement `renderProductDirectory(data)` as grouped semantic lists with workflow headings and ten case rows, preserving corpus order.

In `app.js`, import `renderProductDirectory`, require `#product-directory-mount`, and replace its children after data validation. A directory rendering failure must not remove the hero, featured proofs, workflow selector, or pilot safeguards.

- [ ] **Step 4: Extend HTTP integration coverage**

In `test/vips-pitch-e2e.test.js`, assert the revised render module is served, the directory mount exists, and loaded HTML contains exactly ten safe product anchors after rendering through the exported function.

- [ ] **Step 5: Run tests and confirm GREEN**

Run:

```bash
node --test test/unit/vips-pitch-render.test.js test/vips-pitch-e2e.test.js
```

Expected: all product-link and existing progressive-evidence tests pass.

- [ ] **Step 6: Commit**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js \
  test/unit/vips-pitch-render.test.js test/vips-pitch-e2e.test.js
git commit -m "feat: surface verified VIPS product links"
```

---

### Task 3: Add Trusted VIPS And Saved-Page Assets

**Files:**

- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/vips-icon.ico`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/pixverse-touch-icon.png`
- Create: `deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/brand-assets.json`
- Create: `test/vips-pitch-brand.test.js`

**Interfaces:**

- Consumes: first-party `https://www.vip.com/favicon.ico` and existing `assets/brand/pixverse-logo.svg`.
- Produces: locally hosted verified brand assets and a public-safe integrity manifest.

- [ ] **Step 1: Write the failing brand integrity test**

Create `test/vips-pitch-brand.test.js` to assert:

```js
assert.deepEqual(manifest.assets.map(({ id }) => id), ["vips-site-icon", "pixverse-touch-icon"]);
assert.equal(manifest.assets[0].sourceUrl, "https://www.vip.com/favicon.ico");
assert.equal(manifest.assets[0].sha256, "bb13d3b13ead92bd6c7ba6f654ec9016710a5c92c6e7ca2942c3207e3d9d9539");
assert.equal(manifest.assets[0].width, 16);
assert.equal(manifest.assets[0].height, 16);
assert.equal(manifest.assets[1].width, 180);
assert.equal(manifest.assets[1].height, 180);
```

Read both files, recompute SHA-256, verify MIME with magic bytes or `file`, and assert every manifest path stays within `assets/brand/`.

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --test test/vips-pitch-brand.test.js
```

Expected: FAIL because the assets and manifest do not exist.

- [ ] **Step 3: Download and verify the exact first-party icon**

Use a temporary directory and stop if any check differs:

```bash
asset_tmp=$(mktemp -d)
curl -fsSL --proto '=https' --tlsv1.2 'https://www.vip.com/favicon.ico' -o "$asset_tmp/vips-icon.ico"
file --brief --mime-type "$asset_tmp/vips-icon.ico"
shasum -a 256 "$asset_tmp/vips-icon.ico"
```

Expected MIME: `image/vnd.microsoft.icon`. Expected SHA-256: `bb13d3b13ead92bd6c7ba6f654ec9016710a5c92c6e7ca2942c3207e3d9d9539`. If the first-party bytes changed, stop and inspect rather than silently accepting a new asset.

Move the validated file into `assets/brand/vips-icon.ico` using a non-destructive file operation.

- [ ] **Step 4: Generate the PixVerse Apple touch icon**

Use the existing approved SVG and deterministic local conversion:

```bash
sips -s format png assets/brand/pixverse-logo.svg --out assets/brand/pixverse-touch-icon.png
sips -z 180 180 assets/brand/pixverse-touch-icon.png
```

Run from the pitch root. Verify `sips -g pixelWidth -g pixelHeight` reports `180` and `180`.

- [ ] **Step 5: Write the manifest and pass the integrity test**

Create `brand-assets.json` with `schemaVersion: "vips-brand-assets.v1"`. For each asset record `id`, relative `path`, `mimeType`, `width`, `height`, `bytes`, `sha256`, `sourceUrl`, and `retrievedAt: "2026-09-20"`. For the touch icon, set `sourceUrl` to the local approved PixVerse SVG path rather than an external URL.

Run:

```bash
node --test test/vips-pitch-brand.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

The repository ignores broad asset paths, so verify staging explicitly:

```bash
git add -f deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/vips-icon.ico \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/pixverse-touch-icon.png \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/brand-assets.json
git add test/vips-pitch-brand.test.js
git ls-files deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/
git commit -m "feat: add verified VIPS co-brand assets"
```

Expected: all four brand assets, including the pre-existing PixVerse SVG, appear in `git ls-files`.

---

### Task 4: Reshape The Shell Into A Customer-Ready Share Page

**Files:**

- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css`
- Modify: `test/vips-pitch-page.test.js`
- Modify: `test/vips-pitch-e2e.test.js`

**Interfaces:**

- Consumes: local brand assets from Task 3 and product directory mount from Task 2.
- Produces: co-branded, Chinese-first, private-shareable page shell.

- [ ] **Step 1: Write failing page-story tests**

Add assertions for:

```js
assert.match(html, /class="customer-brand"/);
assert.match(html, /assets\/brand\/vips-icon\.ico/);
assert.match(html, /唯品会/);
assert.match(html, /aria-hidden="true">×</);
assert.match(html, /assets\/brand\/pixverse-logo\.svg/);
assert.match(html, /rel="apple-touch-icon"[^>]+pixverse-touch-icon\.png/);
assert.match(html, /为唯品会真实商品，选择三条最值得试点的视频工作流/);
assert.match(html, /id="product-directory"/);
assert.match(html, /id="product-directory-mount"/);
assert.match(html, /product-fidelity|商品一致性通过率/i);
assert.doesNotMatch(featuredHtml, /Agent|模型|prompt|重试|job/i);
```

Assert the static creative-skincare card links to exactly `https://detail.vip.com/detail-1711533687-6922097426018636437.html` with `target="_blank" rel="noreferrer"`. Assert the other two featured proofs do not acquire an invented product URL.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
```

Expected: FAIL on the missing co-brand, directory, customer headline, metrics, and touch icon.

- [ ] **Step 3: Implement the semantic customer-ready shell**

Update the head with the revised title and description, retain `noindex`, keep the PixVerse favicon, and add:

```html
<link rel="apple-touch-icon" sizes="180x180" href="./assets/brand/pixverse-touch-icon.png">
```

Replace the current single-brand header with:

```html
<a class="co-brand-lockup" href="#main" aria-label="唯品会与 PixVerse 私人能力提案">
  <span class="customer-brand">
    <img src="./assets/brand/vips-icon.ico" alt="" width="16" height="16">
    <span>唯品会</span>
  </span>
  <span class="co-brand-separator" aria-hidden="true">×</span>
  <span class="pixverse-brand">
    <img src="./assets/brand/pixverse-logo.svg" alt="" width="24" height="24">
    <span>PixVerse</span>
  </span>
</a>
```

Use the approved H1. Change `Agent 完整表达` to `成片完整表达`. Add the exact skincare product anchor inside its featured card. Insert the `本次评审商品` section with an empty `#product-directory-mount` and a useful loading/failure sentence. Add the four jointly confirmed pilot measures beneath the existing safeguards, explicitly labelled `建议共同确认的衡量标准`.

- [ ] **Step 4: Implement responsive styling**

Use existing tokens only. Add styles for:

- `.co-brand-lockup`, `.customer-brand`, `.pixverse-brand`, `.co-brand-separator`.
- `.featured-product-link`, `.case-product-link`, `.product-directory-link` with visible hover/focus and at least 44-pixel hit areas.
- `.product-directory-grid` with deliberate 3/2/1-column breakpoints.
- `.pilot-metrics` as a restrained list, not nested decorative cards.
- Mobile header wrapping without horizontal overflow.

Keep the customer icon at its native 16×16 within a 24-pixel identity slot; do not blur-upscale it as a hero graphic. Keep PixVerse secondary by typography and opacity, not by making it illegible.

- [ ] **Step 5: Run tests and confirm GREEN**

Run:

```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js test/vips-pitch-brand.test.js
```

Expected: all page, brand, and static HTTP tests pass.

- [ ] **Step 6: Commit**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html \
  deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css \
  test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
git commit -m "feat: make VIPS pitch customer ready"
```

---

### Task 5: Complete Private-Share Release Verification

**Files:**

- Modify: `test/vips-pitch-release.test.js`
- Modify: `test/vips-pitch-brand.test.js`

**Interfaces:**

- Consumes: complete page, model, renderer, and local brand assets from Tasks 1–4.
- Produces: evidence that the private customer artifact is complete, tracked, safe, and browser-ready.

- [ ] **Step 1: Write failing release assertions**

Add assertions that recursively scanned deploy text contains neither Feishu document token:

```js
const forbidden = /YEE4dcLZAoiZC9x9vhzcZKLknsc|L6sbdC5j3obuDoxrpcYcwGySn2e|feishu\.cn|file_token|\/Users\//i;
```

Assert all paths in `brand-assets.json` exist, are tracked by `git ls-files`, and match their bytes and hashes. Assert `_headers` remains byte-identical to the approved private policy.

- [ ] **Step 2: Run the release test and confirm RED if coverage is missing**

Run:

```bash
node --test test/vips-pitch-release.test.js test/vips-pitch-brand.test.js
```

Expected before completing assertions: FAIL on any missing tracked asset or missing token guard.

- [ ] **Step 3: Run all bounded VIPS verification**

```bash
node --test test/vips-*.test.js test/unit/vips-pitch-*.test.js
npm run test:vips-pitch:coverage
npm run check
npm run security:scan
npm audit --audit-level=high
git diff --check
```

Expected: all VIPS tests pass; coverage is at least 80% for statements, branches, functions, and lines; syntax, secrets, dependency audit, and whitespace checks pass.

- [ ] **Step 4: Run broader regression tests**

```bash
npm test
npm run test:pitches
```

Expected: `npm test` passes. If the two known REVOLVE missing-asset checks remain the only `test:pitches` failures, record them as unrelated and do not modify REVOLVE files in this task.

- [ ] **Step 5: Perform live browser review**

Serve the pitch root on an unused localhost port. Verify at 320×768, 768×1024, 1366×768, and 1920×1080:

- VIPS identity leads the co-brand lockup and PixVerse remains secondary.
- Hero proof remains visible in the first desktop viewport.
- Product directory renders ten case entries and nine unique destinations.
- The featured skincare product link opens the exact verified VIPS URL in a new tab.
- Three-workflow selection, fourth-choice rejection, copy success, and manual-copy fallback work.
- Chapter, case, and attempt deep links open only required ancestors.
- Keyboard focus, 200% zoom, reduced motion, and narrow-screen wrapping remain usable.
- No horizontal overflow, broken media, CSP errors, console errors, or unexpected requests occur.

Do not log in, submit forms, or publish the page during this review.

- [ ] **Step 6: Review task-owned diff and commit verification**

```bash
git status --short
git diff --check
git diff --stat cd932f1..HEAD
git ls-files deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/brand/
git add test/vips-pitch-release.test.js test/vips-pitch-brand.test.js
git commit -m "test: verify VIPS private share page"
```

Expected: no uncommitted task-owned changes; all new brand assets are tracked; unrelated work remains untouched.

## Execution Handoff

Execute in the existing isolated worktree:

`/Users/john/Projects/Codex/Worktrees/pixverse-api-kit-vips-decision`

Do not merge, push, publish, or deploy as part of plan execution. Those external actions require a separate explicit request after review.
