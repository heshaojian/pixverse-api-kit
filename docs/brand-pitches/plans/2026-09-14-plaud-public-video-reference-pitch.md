# Plaud Public Video Reference Pitch Implementation Plan

**Goal:** Rebuild the local Plaud pitch into a proof-first, public-reference-informed page for Plaud marketers.

**Architecture:** Keep the deliverable as one dependency-free HTML document and one Node test file. Preserve the six verified MP4 URLs, use semantic HTML and CSS variables from the PixVerse design system, and encode the customer-facing content contract in tests before changing the page.

**Tech Stack:** Static HTML/CSS, Node.js built-in test runner, Playwright 1.49.1 for browser verification.

**Spec:** `docs/brand-pitches/specs/2026-09-14-plaud-public-video-reference-pitch-design.md`

## Global Constraints

- Edit only `deploy/brand-pitches/plaud/plaud-pixverse-0914/index.html`, `test/plaud-pitch.test.js`, and the two scoped planning documents.
- Preserve all six existing PixVerse MP4 URLs and their poster URLs.
- Keep only Plaud Note Pro, Plaud Note, Plaud NotePin S, Plaud NotePin, and Plaud One in the hardware range.
- Keep public sources customer-visible but do not expose internal research, production, or generation mechanics.
- Preserve the dirty active checkout; do not commit or revert unrelated user changes.

---

### Task 1: Lock The Customer-Facing Contract

**Files:**
- Modify: `test/plaud-pitch.test.js`
- Test: `test/plaud-pitch.test.js`

**Interfaces:**
- Consumes: the existing static page and six approved media URLs.
- Produces: assertions for `#formats`, `#signals`, `#hardware`, `#proof`, and `#pilot` plus the public-source and copy-safety contract.

- [ ] **Step 1: Write the failing test**

Add assertions equivalent to:

```js
assert.deepEqual(orderedSectionIds, ["formats", "signals", "hardware", "proof", "pilot"]);
assert.match(getVisibleText(formats), /Public video reference map/i);
assert.match(getVisibleText(formats), /Product Page Motion/i);
assert.match(getVisibleText(formats), /Performance \/ Social Ads/i);
assert.match(getVisibleText(formats), /Premium Launch Films/i);
assert.match(getVisibleText(signals), /visible in hand, worn, or on phone/i);
assert.doesNotMatch(getVisibleText(html), /Plaud Intelligence|Ask Plaud|templates|internal|prompt|pipeline/i);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/plaud-pitch.test.js`

Expected: FAIL because the current page lacks the new reference map, five-rule section, and new story order.

- [ ] **Step 3: Confirm failure scope**

Verify that failures describe missing customer requirements rather than syntax, fixtures, or unavailable media.

### Task 2: Rebuild The Plaud Pitch

**Files:**
- Modify: `deploy/brand-pitches/plaud/plaud-pixverse-0914/index.html`
- Test: `test/plaud-pitch.test.js`

**Interfaces:**
- Consumes: the Task 1 content contract and the six existing MP4/poster pairs.
- Produces: one customer-facing static page with a proof-first hero, three-format reference map, five public-video rules, five-product hardware range, supporting proof shelf, and one-device focused pilot.

- [ ] **Step 1: Replace the page structure and copy**

Use semantic sections in this order:

```html
<section id="hero">...</section>
<section id="formats">...</section>
<section id="signals">...</section>
<section id="hardware">...</section>
<section id="proof">...</section>
<section id="pilot">...</section>
```

- [ ] **Step 2: Implement the visual system**

Use the canonical black/white-alpha tokens, `Plus Jakarta Sans`, `Inconsolata`, 4-pixel spacing rhythm, bounded `9 / 16` media, visible focus, 44-pixel targets, and the create gradient only on the closing action.

- [ ] **Step 3: Run the focused test**

Run: `node --test test/plaud-pitch.test.js`

Expected: all Plaud pitch tests pass.

### Task 3: Verify Customer Readiness

**Files:**
- Inspect: `deploy/brand-pitches/plaud/plaud-pixverse-0914/index.html`
- Inspect: `test/plaud-pitch.test.js`

**Interfaces:**
- Consumes: the completed static page.
- Produces: automated, responsive, media, accessibility, and review evidence.

- [ ] **Step 1: Run the complete repository checks**

Run: `npm test` and `npm run check`.

Expected: all tests and syntax checks pass.

- [ ] **Step 2: Run browser layout checks**

Serve the repository locally and use Playwright at `1440 x 1000` and `390 x 844`. Assert `document.documentElement.scrollWidth === document.documentElement.clientWidth`, confirm every section has a visible rectangle, and capture full-page screenshots for visual inspection.

- [ ] **Step 3: Check public assets**

Extract page `href`, `src`, and `poster` URLs; issue bounded HTTP checks and verify successful MP4 byte-range behavior and reachable poster/product/reference resources.

- [ ] **Step 4: Review the diff**

Inspect only the scoped page, test, and plan/spec diff; confirm no secrets, local paths, internal identifiers, or unrelated edits entered the customer page.
