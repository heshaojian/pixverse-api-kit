# REVOLVE PDP Internal Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate, no-index internal review page containing all fourteen REVOLVE Standard/high PDP videos without modifying or deploying over the 0911 page.

**Architecture:** A sanitized `catalog.json` records the approved presentation fields and exact Standard/high media URLs. A static HTML release follows the established 0911 proof-first composition, with local brand assets and deliberately extracted poster frames; a small standalone script progressively loads posters and handles media failures. Node release-contract tests bind the catalog, rendered page, privacy controls, assets, and immutable V4 source together.

**Tech Stack:** Static HTML5, CSS custom properties mapped to PixVerse Design System v1.0.1, browser-native JavaScript, Node.js 20 test runner, FFmpeg/FFprobe, and a local static HTTP server.

**Spec:** `docs/brand-pitches/specs/2026-09-20-revolve-pdp-internal-review-design.md`

## Global Constraints

- New release root is exactly `deploy/brand-pitches/revolve/pdp-review/`.
- Proposed internal-review URL is `https://revolve-pdp-review.pages.dev/`; do not create or deploy that project during implementation.
- Reserve `https://revolve-pdp.pages.dev/` for a later approved customer-facing release.
- Do not modify `deploy/brand-pitches/revolve/v4/` or deploy to `revolve-pixverse-0911`.
- Present exactly fourteen products in the established campaign order.
- Use only Standard/high PDP outputs; `LIOR-WD140` must use video ID `638228089914000695`.
- Use centered `object-fit: contain` for every inline and fullscreen video. Never use `cover` for product media.
- Use `preload="metadata"` for exactly one video and `preload="none"` for the other thirteen.
- Load one initial poster on mobile and three on desktop, then defer the rest with `IntersectionObserver`.
- Include `noindex, nofollow, noarchive`; do not add analytics, cookies, review forms, or customer-specific social preview imagery.
- Do not expose prompts, API keys, job IDs, wallet data, local paths, timestamps, or generation prices in deployable files.
- Use Plus Jakarta Sans, a pure-black canvas, white-alpha depth, PixVerse token radii/spacing, visible focus, 44-pixel touch targets, and no static shadows.
- Preserve unrelated working-tree changes and stage only files owned by the current task.
- Every task follows RED → GREEN → review → commit.

---

### Task 1: Define the Sanitized Fourteen-Product Review Catalog

**Files:**
- Create: `test/revolve-pdp-review-release.test.js`
- Create: `deploy/brand-pitches/revolve/pdp-review/catalog.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `pixverse-api-jobs/revolve-pdp/campaign.json`, `pixverse-api-jobs/revolve-pdp/standard-high-batch-results.json`, and `pixverse-api-jobs/revolve-pdp/comparisons/lior-wd140-standard-high/qa.json`.
- Produces: `catalog.json` with schema `revolve-pdp-review.v1` and fourteen ordered presentation records.

- [ ] **Step 1: Write the failing catalog contract test**

Create `test/revolve-pdp-review-release.test.js` with the following foundation:

```js
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

const reviewRoot = new URL("../deploy/brand-pitches/revolve/pdp-review/", import.meta.url);
const v4Page = new URL("../deploy/brand-pitches/revolve/v4/index.html", import.meta.url);
const campaignRoot = new URL("../pixverse-api-jobs/revolve-pdp/", import.meta.url);
const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("review catalog contains the fourteen Standard/high PDP outputs in campaign order", async () => {
  const [catalog, campaign, batch, comparison] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    readJson(new URL("campaign.json", campaignRoot)),
    readJson(new URL("standard-high-batch-results.json", campaignRoot)),
    readJson(new URL("comparisons/lior-wd140-standard-high/qa.json", campaignRoot)),
  ]);

  assert.equal(catalog.schemaVersion, "revolve-pdp-review.v1");
  assert.equal(catalog.products.length, 14);
  assert.equal(new Set(catalog.products.map(({ id }) => id)).size, 14);
  assert.deepEqual(
    catalog.products.map(({ id }) => id),
    campaign.products.map(({ product_id: productId }) => productId),
  );
  assert.equal(campaign.settings.mode, "standard");
  assert.equal(campaign.settings.quality, "high");

  const expectedVideos = new Map(batch.results.map((result) => [result.product_id, result.video_url]));
  expectedVideos.set("LIOR-WD140", comparison.standard_high.video_url);
  for (const product of catalog.products) {
    assert.equal(product.videoUrl, expectedVideos.get(product.id), product.id);
    assert.match(product.productUrl, /^https:\/\/www\.revolve\.com\//);
    assert.match(product.poster, /^\.\/assets\/posters\/[A-Z0-9-]+\.jpg$/);
    assert.ok(product.motionDescription.trim(), product.id);
  }
});

test("the original 0911 source remains byte-identical", async () => {
  assert.equal(
    sha256(await fs.readFile(v4Page)),
    "f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948",
  );
});
```

- [ ] **Step 2: Add an isolated test command and verify RED**

Add this package script without changing existing scripts:

```json
"test:revolve-pdp-review": "node --test test/revolve-pdp-review-release.test.js"
```

Run:

```bash
npm run test:revolve-pdp-review
```

Expected: the catalog test fails with `ENOENT` for `pdp-review/catalog.json`; the immutable V4 hash test passes.

- [ ] **Step 3: Create the sanitized catalog**

Create `catalog.json` with this exact top-level shape:

```json
{
  "schemaVersion": "revolve-pdp-review.v1",
  "title": "REVOLVE PDP Video Review",
  "canonicalUrl": "https://revolve-pdp-review.pages.dev/",
  "products": []
}
```

Populate fourteen records in campaign order. Each record must contain only:

```json
{
  "order": 1,
  "id": "SDYS-WD257",
  "brand": "SNDYS",
  "name": "x REVOLVE Avani Dress",
  "variant": "Pear",
  "productUrl": "https://www.revolve.com/sndys-x-revolve-avani-dress-in-pear/dp/SDYS-WD257/",
  "videoUrl": "https://media.pixverse.ai/pixverse/mp4/media/workflow-studio/concat_11769_20260920T224332Z_compose_video_and_music.mp4",
  "poster": "./assets/posters/SDYS-WD257.jpg",
  "posterTimeSeconds": 2,
  "featured": true,
  "motionDescription": "A model presents the pear-green satin midi dress from clear front, side, and back angles so reviewers can inspect its finish, drape, neckline, and hem."
}
```

Use `featured: true` for orders 1–6 and `false` for orders 7–14. Use `posterTimeSeconds: 2` for 8-second outputs and `3` for 10-second outputs. Take product names, variants, links, and motion descriptions from the existing V4 cards; take video URLs only from the Standard/high result artifacts.

- [ ] **Step 4: Add confidentiality assertions**

Append this test:

```js
test("review catalog is presentation-only and contains no private operations data", async () => {
  const raw = await fs.readFile(new URL("catalog.json", reviewRoot), "utf8");
  assert.doesNotMatch(raw, /mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:\s*Bearer/i);
  assert.doesNotMatch(raw, /\/Users\/|job_dir|video_id|ledger|price|wallet|prompt|created_at/i);
});
```

- [ ] **Step 5: Run the catalog tests and commit**

Run:

```bash
npm run test:revolve-pdp-review
```

Expected: all three tests pass.

Commit:

```bash
git add package.json test/revolve-pdp-review-release.test.js deploy/brand-pitches/revolve/pdp-review/catalog.json
git commit -m "feat: add REVOLVE PDP review catalog"
```

---

### Task 2: Build the Isolated 0911-Style Review Page

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/index.html`
- Create: `deploy/brand-pitches/revolve/pdp-review/styles.css`
- Create: `deploy/brand-pitches/revolve/pdp-review/app.js`
- Create: `deploy/brand-pitches/revolve/pdp-review/_headers`
- Create: `deploy/brand-pitches/revolve/pdp-review/robots.txt`
- Create: `deploy/brand-pitches/revolve/pdp-review/assets/revolve-wordmark.png`
- Create: `deploy/brand-pitches/revolve/pdp-review/assets/pixverse-logo.svg`
- Modify: `test/revolve-pdp-review-release.test.js`

**Interfaces:**
- Consumes: the ordered, sanitized fields in `catalog.json` and approved brand assets already present in `deploy/brand-pitches/revolve/v4/assets/`.
- Produces: a self-contained, no-index review page with fourteen static cards and progressive poster behavior.

- [ ] **Step 1: Write failing page-contract tests**

Append tests that read `index.html`, `styles.css`, `app.js`, `_headers`, and `robots.txt`, then assert:

```js
test("review page is isolated, no-index, and renders fourteen product proofs", async () => {
  const [catalog, html, css, app, headers, robots] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    fs.readFile(new URL("index.html", reviewRoot), "utf8"),
    fs.readFile(new URL("styles.css", reviewRoot), "utf8"),
    fs.readFile(new URL("app.js", reviewRoot), "utf8"),
    fs.readFile(new URL("_headers", reviewRoot), "utf8"),
    fs.readFile(new URL("robots.txt", reviewRoot), "utf8"),
  ]);

  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(html, /<title>REVOLVE × PixVerse \| PDP Video Review<\/title>/);
  assert.equal((html.match(/<video\b/g) ?? []).length, 14);
  assert.equal((html.match(/aria-describedby="motion-/g) ?? []).length, 14);
  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 13);
  assert.ok(catalog.products.every(({ videoUrl, productUrl }) =>
    html.includes(videoUrl) && html.includes(productUrl)
  ));
  assert.match(html, />Internal Review</);
  assert.doesNotMatch(html, /Pilot|Schedule|mailto:|revolve-pdp\.pages\.dev/);
  assert.match(css, /\.demo-media video[^}]*object-fit:\s*contain/s);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(app, /IntersectionObserver/);
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow, noarchive/i);
  assert.match(robots, /Disallow:\s*\//);
});
```

Add a security test:

```js
test("deployable review files expose no credentials or internal artifacts", async () => {
  const names = ["index.html", "styles.css", "app.js", "catalog.json", "_headers", "robots.txt"];
  const raw = (await Promise.all(names.map((name) =>
    fs.readFile(new URL(name, reviewRoot), "utf8")
  ))).join("\n");
  assert.doesNotMatch(raw, /mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:\s*Bearer|\/Users\//i);
  assert.doesNotMatch(raw, /job_dir|video_id|ledger_source|wallet|generation-command/i);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm run test:revolve-pdp-review
```

Expected: failure for missing page release files.

- [ ] **Step 3: Create the page shell and static product cards**

Use V4 as the structural reference, not as a file to modify. Build a new `index.html` with:

- a skip link;
- compact REVOLVE × PixVerse header;
- `Internal Review` label;
- headline `Review fourteen PDP videos built from REVOLVE product imagery.`;
- six featured cards and eight additional cards;
- no pilot section or outbound email CTA;
- footer copy `Internal review only. Prepared by PixVerse from public REVOLVE product references.`;
- fourteen static `<article>` elements matching `catalog.json` exactly;
- one `preload="metadata"` player followed by thirteen `preload="none"` players;
- `poster` only on the first player and `data-poster` on all fourteen players;
- descriptive `aria-label` and `aria-describedby` attributes;
- `rel="noreferrer"` on external links.

Keep Open Graph/Twitter promotional tags out of this internal release. Set canonical metadata only to `https://revolve-pdp-review.pages.dev/`.

- [ ] **Step 4: Implement the visual system in `styles.css`**

Define named CSS variables from PixVerse Design System v1.0.1 rather than scattering values:

```css
:root {
  --background-primary: #000;
  --surface-rest: rgba(255, 255, 255, 0.08);
  --surface-hover: rgba(255, 255, 255, 0.16);
  --border-primary: rgba(255, 255, 255, 0.12);
  --border-secondary: rgba(255, 255, 255, 0.06);
  --text-primary: #fff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-tertiary: rgba(255, 255, 255, 0.4);
  --radius-control: 8px;
  --radius-card: 16px;
  --font-app: "Plus Jakarta Sans", system-ui, sans-serif;
}
```

Implement:

- sticky 56-pixel header with a white-alpha divider;
- compact first viewport with the first video proof visible at 1080 pixels high;
- two-column featured grid at wide widths and one column under 820 pixels;
- four-column additional grid on wide screens, two columns on tablet, one on narrow mobile;
- stable `aspect-ratio: 9 / 16` media frames;
- centered `contain` video inline and fullscreen;
- visible `:focus-visible` treatment;
- 44-pixel minimum action height;
- text wrapping for long product names;
- reduced-motion override;
- no static box shadows, decorative orbs, or letter spacing.

- [ ] **Step 5: Implement poster loading and media fallback in `app.js`**

Use this behavior:

```js
const posterVideos = [...document.querySelectorAll("video[data-poster]")];

const loadPoster = (video) => {
  if (!video.dataset.poster) return;
  video.poster = video.dataset.poster;
  delete video.dataset.poster;
};

const eagerPosterCount = window.matchMedia("(min-width: 821px)").matches ? 3 : 1;
posterVideos.slice(0, eagerPosterCount).forEach(loadPoster);

const deferred = posterVideos.slice(eagerPosterCount);
if (!("IntersectionObserver" in window)) {
  deferred.forEach(loadPoster);
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadPoster(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: window.matchMedia("(min-width: 821px)").matches ? "500px 0px" : "200px 0px" });
  deferred.forEach((video) => observer.observe(video));
}

for (const video of document.querySelectorAll("video")) {
  video.addEventListener("error", () => {
    video.closest(".demo-media")?.classList.add("media-unavailable");
  }, { once: true });
}
```

Add a static `.media-fallback` message to each card and reveal it through `.media-unavailable` CSS.

- [ ] **Step 6: Add privacy and security headers**

Create `robots.txt`:

```text
User-agent: *
Disallow: /
```

Create `_headers` with:

```text
/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; media-src 'self' https://media.pixverse.ai; style-src 'self'; script-src 'self'; connect-src 'self' https://media.pixverse.ai; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
```

- [ ] **Step 7: Copy only the approved brand assets**

Copy these byte-for-byte into the new release:

```bash
cp deploy/brand-pitches/revolve/v4/assets/revolve-wordmark.png deploy/brand-pitches/revolve/pdp-review/assets/revolve-wordmark.png
cp deploy/brand-pitches/revolve/v4/assets/pixverse-logo.svg deploy/brand-pitches/revolve/pdp-review/assets/pixverse-logo.svg
```

Do not copy the V4 social image, old posters, records, prompts, or videos.

- [ ] **Step 8: Run tests and commit the page shell**

Run:

```bash
npm run test:revolve-pdp-review
```

Expected: page, privacy, isolation, and security tests pass; poster-existence assertions are not added until Task 3.

Commit:

```bash
git add deploy/brand-pitches/revolve/pdp-review test/revolve-pdp-review-release.test.js
git commit -m "feat: build REVOLVE PDP review page"
```

---

### Task 3: Extract and Validate Fresh Standard/high Poster Frames

**Files:**
- Create: `deploy/brand-pitches/revolve/pdp-review/assets/posters/*.jpg` (14 files)
- Modify: `deploy/brand-pitches/revolve/pdp-review/catalog.json` only if a reviewed poster timestamp changes
- Modify: `test/revolve-pdp-review-release.test.js`

**Interfaces:**
- Consumes: `videoUrl`, `poster`, and `posterTimeSeconds` from `catalog.json`.
- Produces: fourteen local JPEG posters whose filenames match product IDs exactly.

- [ ] **Step 1: Add failing poster-asset assertions**

Append:

```js
test("every product has a nonempty local poster", async () => {
  const catalog = await readJson(new URL("catalog.json", reviewRoot));
  for (const product of catalog.products) {
    const poster = new URL(product.poster.replace(/^\.\//, ""), reviewRoot);
    const stat = await fs.stat(poster);
    assert.ok(stat.isFile(), product.id);
    assert.ok(stat.size > 10_000, `${product.id} poster is unexpectedly small`);
  }
});
```

Run `npm run test:revolve-pdp-review` and expect failure on the first missing poster.

- [ ] **Step 2: Extract all posters from the new outputs**

Create the poster directory and execute this catalog-driven extraction:

```bash
mkdir -p deploy/brand-pitches/revolve/pdp-review/assets/posters
jq -r '.products[] | [.id, .videoUrl, (.posterTimeSeconds | tostring)] | @tsv' \
  deploy/brand-pitches/revolve/pdp-review/catalog.json |
while IFS=$'\t' read -r product_id video_url poster_time; do
  ffmpeg -y -v error -ss "$poster_time" -i "$video_url" \
    -frames:v 1 -vf 'scale=720:-2' -q:v 2 \
    "deploy/brand-pitches/revolve/pdp-review/assets/posters/${product_id}.jpg"
done
```

- [ ] **Step 3: Create review contact sheets**

Generate a temporary contact sheet outside the release directory:

```bash
poster_sheet_dir="$(mktemp -d)"
ffmpeg -y -v error \
  -pattern_type glob \
  -i 'deploy/brand-pitches/revolve/pdp-review/assets/posters/*.jpg' \
  -vf 'scale=180:-2,tile=7x2' \
  -frames:v 1 "$poster_sheet_dir/revolve-pdp-posters.jpg"
```

Inspect the sheet and each questionable full-size poster. A poster passes only when the product is centered, mostly visible, sharp, and free from walk-in/walk-out cropping. If a poster fails, change only that product's `posterTimeSeconds`, regenerate it, and inspect again.

- [ ] **Step 4: Verify poster encoding**

Run:

```bash
for poster in deploy/brand-pitches/revolve/pdp-review/assets/posters/*.jpg; do
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=codec_name,width,height \
    -of csv=p=0 "$poster"
done
```

Expected: fourteen JPEG outputs, each 720 pixels wide, with a portrait height and no decode errors.

- [ ] **Step 5: Run tests and commit posters**

Run `npm run test:revolve-pdp-review`; expect all tests to pass.

Commit:

```bash
git add deploy/brand-pitches/revolve/pdp-review/assets/posters deploy/brand-pitches/revolve/pdp-review/catalog.json test/revolve-pdp-review-release.test.js
git commit -m "feat: add reviewed PDP poster frames"
```

---

### Task 4: Verify Media Integrity, Responsiveness, and Loading Behavior

**Files:**
- Modify: `test/revolve-pdp-review-release.test.js`
- Modify: release files only when verification identifies a defect
- Create: `pixverse-api-jobs/revolve-pdp/review-page-qa.json`

**Interfaces:**
- Consumes: the complete local review release and fourteen remote Standard/high videos.
- Produces: automated release checks plus a non-deployable QA record under the job-artifact tree.

- [ ] **Step 1: Add media URL and source-of-truth checks**

Append a test that verifies every video URL uses HTTPS `media.pixverse.ai`, is unique, and is present exactly twice in HTML: once as the player source and once as the direct-video link.

```js
test("each Standard/high video appears once as a player and once as a direct link", async () => {
  const [catalog, html] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    fs.readFile(new URL("index.html", reviewRoot), "utf8"),
  ]);
  assert.equal(new Set(catalog.products.map(({ videoUrl }) => videoUrl)).size, 14);
  for (const { id, videoUrl } of catalog.products) {
    const escaped = videoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(videoUrl, /^https:\/\/media\.pixverse\.ai\//);
    assert.equal((html.match(new RegExp(escaped, "g")) ?? []).length, 2, id);
  }
});
```

- [ ] **Step 2: Verify all fourteen remote videos without downloading them**

For every catalog URL, run FFprobe and record `width`, `height`, `fps`, and duration. Expected:

- all videos: H.264, `1440 × 2560`, 30 fps;
- orders 1–7, 9, 11, 13, and 14: approximately 8.02 seconds;
- orders 8, 10, and 12: approximately 10.16 seconds.

Do not retry or regenerate media if inspection fails; report the exact failing URL.

- [ ] **Step 3: Start a local review server**

Run from the repository root:

```bash
python3 -m http.server 52833 --directory deploy/brand-pitches/revolve/pdp-review
```

Open `http://localhost:52833/` in the in-app browser.

- [ ] **Step 4: Perform desktop browser QA**

At 1440 × 900 and 1920 × 1080, verify:

- strongest proof appears in the first viewport;
- two featured columns and four additional columns render without overflow;
- long names wrap cleanly;
- exactly three poster requests occur before scrolling;
- all fourteen posters become available after scrolling;
- one featured and one non-featured video play and seek;
- direct-video and product links resolve;
- browser console contains no page errors.

- [ ] **Step 5: Perform mobile browser QA**

At 375 × 812 and 320 × 700, verify:

- one-column layout and no horizontal overflow;
- exactly one poster request occurs before scrolling;
- header, links, and native video controls remain usable;
- 44-pixel touch targets and visible focus treatment remain intact;
- one featured and one non-featured player preserve the full product with centered `contain`.

- [ ] **Step 6: Verify privacy and source isolation**

Run:

```bash
npm run security:scan
rg -n 'mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:|/Users/|job_dir|video_id|ledger|wallet|prompt' \
  deploy/brand-pitches/revolve/pdp-review
shasum -a 256 deploy/brand-pitches/revolve/v4/index.html
```

Expected:

- secret scan passes;
- `rg` returns no matches;
- V4 hash remains `f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948`.

- [ ] **Step 7: Record QA evidence**

Create `pixverse-api-jobs/revolve-pdp/review-page-qa.json` with:

```json
{
  "release_root": "deploy/brand-pitches/revolve/pdp-review",
  "canonical_url": "https://revolve-pdp-review.pages.dev/",
  "publication_status": "local-only",
  "products": 14,
  "videos_verified": 14,
  "posters_verified": 14,
  "desktop_viewports": ["1440x900", "1920x1080"],
  "mobile_viewports": ["375x812", "320x700"],
  "initial_poster_requests": { "desktop": 3, "mobile": 1 },
  "horizontal_overflow": false,
  "console_errors": 0,
  "v4_sha256": "f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948",
  "result": "passed"
}
```

Do not add deployment identifiers because deployment is out of scope.

- [ ] **Step 8: Run the full relevant suite and commit QA**

Run:

```bash
npm run test:revolve-pdp-review
npm run test:api
npm run check
npm run security:scan
```

Expected: all commands pass. Do not use the older `test/revolve-pdp-release.test.js` as the completion gate because it targets the future customer release at `deploy/brand-pitches/revolve/pdp/`.

Commit:

```bash
git add test/revolve-pdp-review-release.test.js deploy/brand-pitches/revolve/pdp-review pixverse-api-jobs/revolve-pdp/review-page-qa.json
git commit -m "test: verify REVOLVE PDP review release"
```

---

### Task 5: Final Review and Local Handoff

**Files:**
- Modify: implementation files only for confirmed review defects
- No deployment files or Cloudflare resources are created

**Interfaces:**
- Consumes: the passing local release and QA record.
- Produces: a locally viewable, commit-backed internal review artifact ready for a separate publish decision.

- [ ] **Step 1: Review the complete branch diff**

Run:

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- deploy/brand-pitches/revolve/pdp-review test/revolve-pdp-review-release.test.js package.json
git status --short
```

Confirm that no unrelated working-tree files are staged and no V4 files changed.

- [ ] **Step 2: Run the final release gate**

Run:

```bash
npm run test:revolve-pdp-review && npm run check && npm run security:scan
```

Expected: exit code 0 for every command.

- [ ] **Step 3: Open the local review page for the user**

Keep the local server running and open `http://localhost:52833/` in the Codex browser panel. Do not create a Cloudflare project or publish externally.

- [ ] **Step 4: Report the publication boundary**

Hand off:

- local URL;
- release path;
- test and QA result;
- confirmation that V4/0911 is unchanged;
- proposed future URL `https://revolve-pdp-review.pages.dev/`;
- an explicit note that public deployment still requires separate approval.
