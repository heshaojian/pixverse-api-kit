# VIPS Decision Pitch Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Chinese VIPS evidence ledger into a proof-first decision page that lets a customer select exactly three workflows and copy a controlled-pilot summary while preserving all 29 reviewed cases.

**Architecture:** Keep the existing static HTML/CSS/ES-module application and validated JSON corpus. Add immutable selection and deep-link helpers, reorganize renderer output into chapter → case → complete-review disclosures, and bind progressive interactions in `app.js`; no framework, backend, paid generation, analytics, or new dependency is introduced.

**Tech Stack:** Semantic HTML, CSS, browser ES modules, native `<details>`/checkbox/Clipboard APIs, Node.js test runner, c8 coverage.

**Spec:** `docs/superpowers/specs/2026-09-20-vips-decision-pitch-design.md`

## Global Constraints

- Keep all 29 cases, five chapters, verdicts, prompts, attempts, source revision `1214`, and review date unchanged.
- Use PixVerse design-system v1.0.1 tokens; dark-only, no decorative shadows, no arbitrary new colors, no letter spacing.
- Use one create-gradient action only: `复制试点方案`.
- Keep centered `object-fit: contain` for inline and fullscreen product media.
- Keep the private-preview disclaimer, `noindex`, `_headers`, and no-external-write posture.
- Do not alter `data/cases.json`, `data/media-manifest.json`, `assets/**`, or `_headers`.
- Preserve unrelated untracked work: `pixverse-api-jobs/`, `scripts/prepare-revolve-pdp-campaign.mjs`, and `test/revolve-pdp-release.test.js`.
- Follow red-green-refactor and commit only the files owned by each task.

---

## File Map

- `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js`: validate corpus and provide immutable pilot-selection/summary/deep-link resolution functions.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`: render the three-level evidence appendix and intrinsic media dimensions.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`: static executive narrative, hero proof, workflow controls, pilot summary, fallback, and appendix mount.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css`: PixVerse-token composition, responsive proof hero, workflow rail, disclosures, and states.
- `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js`: fetch/render orchestration, live selection state, clipboard fallback, targeted deep links, disclosure-aware loading, and retry.
- `test/unit/vips-pitch-data-model.test.js`: pure selection, summary, and evidence-target tests.
- `test/unit/vips-pitch-render.test.js`: progressive disclosure, unique IDs, escaping, and intrinsic-dimension tests.
- `test/vips-pitch-page.test.js`: static shell, copy/selection controls, poster budget, CSS, and source-safety assertions.
- `test/vips-pitch-e2e.test.js`: static HTTP delivery and revised artifact requirements.
- `test/vips-pitch-release.test.js`: remains unchanged; used as a release gate.

---

### Task 1: Immutable Pilot Selection and Evidence Addressing

**Files:**
- Modify: `test/unit/vips-pitch-data-model.test.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js`

**Interfaces:**
- Produces: `toggleWorkflowSelection(selectedIds, workflowId, maxSelections = 3)` returning a frozen `{ selectedIds, reason }` object.
- Produces: `buildPilotSummary({ data, selectedIds, safeguards })` returning deterministic Chinese plain text.
- Produces: `resolveEvidenceTarget(data, hashId)` returning a frozen `{ chapterId, caseId, attemptDomId }` ancestry object or `null`.
- Produces: `toAttemptDomId(caseId, attemptId)` returning a globally unique `<case-id>--<attempt-id>` ID.

- [ ] **Step 1: Write failing selection and summary tests**

Add imports and focused tests equivalent to:

```js
import {
  buildPilotSummary,
  resolveEvidenceTarget,
  toAttemptDomId,
  toggleWorkflowSelection,
} from "../../deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js";

test("pilot selection is immutable and rejects a fourth workflow", async () => {
  const fixture = await readFixture();
  const ids = fixture.chapters.slice(0, 3).map(({ id }) => id);
  const selected = toggleWorkflowSelection(Object.freeze(ids), fixture.chapters[3].id);
  assert.deepEqual(selected, { selectedIds: ids, reason: "limit-reached" });
  assert.ok(Object.isFrozen(selected));
  assert.ok(Object.isFrozen(selected.selectedIds));
  assert.deepEqual(ids, fixture.chapters.slice(0, 3).map(({ id }) => id));
});

test("pilot summary requires exactly three valid workflows", async () => {
  const fixture = await readFixture();
  const selectedIds = fixture.chapters.slice(0, 3).map(({ id }) => id);
  const summary = buildPilotSummary({ data: fixture, selectedIds, safeguards: ["确认商品", "确认边界"] });
  assert.match(summary, /修订版 1214/);
  assert.match(summary, new RegExp(fixture.source.reviewDate));
  assert.ok(selectedIds.every((id) => summary.includes(fixture.chapters.find((item) => item.id === id).title)));
  assert.throws(() => buildPilotSummary({ data: fixture, selectedIds: selectedIds.slice(0, 2), safeguards: [] }), /exactly three/i);
});

test("evidence targets use globally unique attempt ids", async () => {
  const fixture = await readFixture();
  const record = fixture.chapters[0].cases[0];
  const attempt = record.attempts[0];
  const attemptDomId = toAttemptDomId(record.id, attempt.id);
  assert.equal(attemptDomId, `${record.id}--${attempt.id}`);
  assert.deepEqual(resolveEvidenceTarget(fixture, attemptDomId), {
    chapterId: fixture.chapters[0].id,
    caseId: record.id,
    attemptDomId,
  });
  assert.equal(resolveEvidenceTarget(fixture, "missing"), null);
});
```

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js
```

Expected: failure because the four new exports do not exist.

- [ ] **Step 3: Implement immutable transitions and deterministic lookup**

Add functions that validate against the five chapter IDs, always copy caller arrays, preserve chapter order in the summary, and never mutate the corpus. Use this transition shape:

```js
export function toggleWorkflowSelection(selectedIds, workflowId, maxSelections = 3) {
  const current = Object.freeze([...selectedIds]);
  if (current.includes(workflowId)) {
    return Object.freeze({
      selectedIds: Object.freeze(current.filter((id) => id !== workflowId)),
      reason: null,
    });
  }
  if (current.length >= maxSelections) {
    return Object.freeze({ selectedIds: current, reason: "limit-reached" });
  }
  return Object.freeze({
    selectedIds: Object.freeze([...current, workflowId]),
    reason: null,
  });
}
```

`buildPilotSummary` must emit these sections in order: title, three workflow titles, four supplied safeguards, `来源：人工评审材料修订版 1214`, and the source review date. `resolveEvidenceTarget` must search chapter IDs, case IDs, and composite attempt IDs without accepting raw non-unique attempt IDs.

- [ ] **Step 4: Run the model tests and coverage**

Run:

```bash
node --test test/unit/vips-pitch-data-model.test.js
npm run test:vips-pitch:coverage
```

Expected: all tests pass; lines, branches, functions, and statements remain at or above 80%.

- [ ] **Step 5: Commit Task 1**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js test/unit/vips-pitch-data-model.test.js
git commit -m "feat: add VIPS pilot selection model"
```

---

### Task 2: Three-Level Evidence Rendering

**Files:**
- Modify: `test/unit/vips-pitch-render.test.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js`

**Interfaces:**
- Consumes: `toAttemptDomId(caseId, attemptId)` from Task 1.
- Produces: chapter `<details>` containing case `<details>` containing `.complete-review-record` `<details>`.
- Preserves: `renderCase`, `renderLedger`, and `safeUrl` exports.

- [ ] **Step 1: Write failing renderer hierarchy tests**

Add assertions equivalent to:

```js
test("case summary keeps implementation detail in the complete review record", async () => {
  const fixture = await readFixture();
  const html = renderCase(fixture.chapters[0].cases[0]);
  const recordStart = html.indexOf('<details class="complete-review-record"');
  assert.ok(recordStart > 0);
  assert.ok(html.indexOf("提示词：") > recordStart);
  assert.ok(html.indexOf("attempt-parameters") > recordStart);
  assert.ok(html.indexOf("review-summary") < recordStart);
  assert.ok(html.indexOf("review-observations") < recordStart);
});

test("rendered media reserves validated intrinsic dimensions", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);
  const dimensioned = fixture.chapters.flatMap(({ cases }) => cases)
    .flatMap(({ inputs, attempts }) => [...inputs, ...attempts.flatMap(({ media }) => media)])
    .find(({ dimensions }) => dimensions.width !== null);
  assert.match(html, new RegExp(`width="${dimensioned.dimensions.width}"`));
  assert.match(html, new RegExp(`height="${dimensioned.dimensions.height}"`));
});

test("attempt ids are composite and globally unique", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);
  const ids = [...html.matchAll(/id="([^"]+--[^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
```

- [ ] **Step 2: Run renderer tests and verify RED**

```bash
node --test test/unit/vips-pitch-render.test.js
```

Expected: hierarchy, dimensions, and composite-ID assertions fail.

- [ ] **Step 3: Refactor pure renderer functions**

Implement the following markup order:

```html
<details class="ledger-chapter" id="chapter-id">
  <summary class="chapter-summary">…verdict and title…</summary>
  <div class="chapter-body">…strengths, limitations, operating conditions…</div>
  <details class="case-record" id="case-id">
    <summary>…case title and verdict…</summary>
    <div class="case-body">
      <p class="case-request">…</p>
      <p class="review-summary">…</p>
      <ul class="review-observations">…</ul>
      <div class="representative-evidence">…last media-bearing attempt only…</div>
      <details class="complete-review-record">
        <summary>完整评审记录</summary>
        …inputs, methods, parameters, prompts, retries, and all remaining media…
      </details>
    </div>
  </details>
</details>
```

Choose the last media-bearing attempt as `representative-evidence` without calling it “best”. Do not render its media twice: in that attempt record, link back to `#<case-id>-representative-evidence` with the text `查看上方代表性结果`. Emit `width`, `height`, and inline `aspect-ratio` only when validated dimensions are non-null. Keep all untrusted strings escaped and all external media links HTTPS plus `rel="noreferrer"`.

- [ ] **Step 4: Run render, data, and coverage tests**

```bash
node --test test/unit/vips-pitch-render.test.js test/unit/vips-pitch-data-model.test.js
npm run test:vips-pitch:coverage
```

Expected: all tests pass and coverage gates stay above 80%.

- [ ] **Step 5: Commit Task 2**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js test/unit/vips-pitch-render.test.js
git commit -m "refactor: add progressive VIPS evidence disclosures"
```

---

### Task 3: Executive Proof Hero and Workflow Rail

**Files:**
- Modify: `test/vips-pitch-page.test.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css`

**Interfaces:**
- Produces DOM IDs used by Task 4: `workflow-selector`, `selection-count`, `selection-limit-message`, `pilot-summary`, `copy-pilot`, `copy-status`, `manual-copy`, `ledger-retry`.
- Produces five checkbox inputs named `pilot-workflow`, with values matching chapter IDs.

- [ ] **Step 1: Replace static page expectations with failing decision-page assertions**

Update tests to require:

```js
assert.match(html, /从真实商品样例中，选择三条最值得试点的电商视频工作流/);
assert.match(html, /class="hero-proof"/);
assert.equal((html.match(/name="pilot-workflow"/g) ?? []).length, 5);
assert.match(html, /id="selection-count"[^>]*>\s*已选择 0 \/ 3\s*</);
assert.match(html, /id="copy-pilot"[^>]*disabled[^>]*>\s*复制试点方案\s*</);
assert.match(html, /id="copy-status"[^>]*aria-live="polite"/);
assert.match(html, /id="manual-copy"[^>]*hidden/);
assert.ok(position(html, 'id="pilot"') < position(html, 'id="ledger"'));
```

Change featured expectations to exactly three executive proofs total: the product-motion hero plus presenter and creative cards. Assert the initial poster budget is one real `poster` on mobile and at most three after desktop attachment. Add CSS assertions for `.hero-layout`, `.workflow-grid`, `grid-template-columns: repeat(5`, two-column tablet behavior, single-column phone behavior, `color-scheme: dark`, and no `box-shadow`, `object-fit: cover`, or `letter-spacing`.

- [ ] **Step 2: Run page tests and verify RED**

```bash
node --test test/vips-pitch-page.test.js
```

Expected: headline, hero proof, selector, decision order, and CSS assertions fail.

- [ ] **Step 3: Restructure the static HTML**

Use a two-column `.hero-layout` containing `.hero-copy-block` and a `.hero-proof` video for the existing pale yellow-green suit. Give the hero the only statically attached poster so mobile requests one poster. Keep presenter and creative proof cards immediately below; move their posters to allowlisted desktop-only data attributes.

Replace the old capability link list with:

```html
<fieldset id="workflow-selector" class="workflow-selector">
  <legend>从五类工作流中选择三类</legend>
  <p id="selection-count" class="selection-count">已选择 0 / 3</p>
  <div class="workflow-grid">…five labeled checkboxes…</div>
  <p id="selection-limit-message" class="selection-message" role="status"></p>
</fieldset>
```

Place the four safeguards and this action group before the ledger:

```html
<section id="pilot" class="pilot" aria-labelledby="pilot-title">
  …selector and safeguards…
  <pre id="pilot-summary" class="pilot-summary" aria-live="polite"></pre>
  <button id="copy-pilot" class="primary-action" type="button" disabled>复制试点方案</button>
  <p id="copy-status" role="status" aria-live="polite"></p>
  <textarea id="manual-copy" hidden readonly aria-label="手动复制试点方案"></textarea>
</section>
```

Add a real `重试加载完整评审` button to the ledger fallback. Keep the private disclaimer unchanged.

- [ ] **Step 4: Implement the PixVerse-token responsive composition**

Remove the full-viewport text-only hero. At `min-width: 1024px`, use two balanced columns and bound the hero proof so it intersects a 1366 × 768 initial viewport. Use a five-column workflow rail at desktop, two columns from 640–1023px, and one column below 640px. Add checkbox selected, focus, disabled, error, summary, and fallback states using white-alpha surfaces; reserve the create gradient for `#copy-pilot` only. Preserve 44px targets, reduced motion, and centered `contain` media.

- [ ] **Step 5: Run page and static HTTP tests**

```bash
node --test test/vips-pitch-page.test.js test/vips-pitch-e2e.test.js
```

Expected: both pass; the updated page and all unchanged assets serve over static HTTP.

- [ ] **Step 6: Commit Task 3**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/index.html deploy/brand-pitches/vips/human-reviewed-ecommerce/styles.css test/vips-pitch-page.test.js
git commit -m "feat: reshape VIPS page around pilot selection"
```

---

### Task 4: Selection, Clipboard, Deep Links, and Recovery

**Files:**
- Modify: `test/vips-pitch-page.test.js`
- Modify: `deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js`

**Interfaces:**
- Consumes: `toggleWorkflowSelection`, `buildPilotSummary`, and `resolveEvidenceTarget` from Task 1.
- Consumes: DOM IDs from Task 3 and composite disclosure IDs from Task 2.
- Produces: exported `attachPilotSelector`, `openEvidenceTarget`, and `attachLedgerRetry` functions for direct unit-style testing with lightweight DOM stubs.

- [ ] **Step 1: Write failing behavior tests with DOM stubs**

Add tests covering:

```js
test("selection enables copy only at exactly three and preserves earlier choices", () => {
  // Build five checkbox stubs plus count, button, message, and summary nodes.
  // Toggle three IDs and assert count "已选择 3 / 3" and button.disabled === false.
  // Toggle a fourth and assert it remains unchecked and message contains "最多选择三类".
});

test("clipboard failure exposes the manual copy fallback", async () => {
  // Inject clipboard.writeText that rejects.
  // Assert textarea.hidden === false, textarea.value equals the summary, select() ran,
  // and the live status explains manual copying.
});

test("deep links open only required disclosure ancestors", () => {
  // Chapter target: open chapter only.
  // Case target: open chapter and case only.
  // Attempt target: open chapter, case, and complete-review-record only.
  // Assert no sibling disclosure was opened.
});
```

Also retain source assertions prohibiting `innerHTML`, `eval`, external fetches, analytics, and form submission.

- [ ] **Step 2: Run behavior tests and verify RED**

```bash
node --test test/vips-pitch-page.test.js
```

Expected: new exported functions and behaviors are absent.

- [ ] **Step 3: Bind immutable selector state**

In `attachPilotSelector`, read the five checkbox values, keep the current IDs in a reassigned frozen array, and call `toggleWorkflowSelection` on `change`. Revert a rejected fourth checkbox, render `已选择 n / 3`, set `aria-checked` through the native input state, update the summary when three are selected, and enable the copy button only at exactly three.

Use dependency injection:

```js
export function attachPilotSelector({ documentRef, data, clipboard = navigator.clipboard }) {
  // Return a cleanup function that removes every listener.
}
```

On copy success, announce `试点方案已复制。`. On rejection, announce `最多选择三类工作流；请先取消一项。`. On Clipboard API absence or rejection, reveal the textarea, assign the exact summary, call `focus()` and `select()`, and announce `无法自动复制，请使用下方文本手动复制。`.

- [ ] **Step 4: Replace mass-opening deep-link behavior**

Use `resolveEvidenceTarget` to find the exact ancestry. Open only the returned chapter, case, and attempt record. Do not iterate over `target.querySelectorAll("details")`. Register one `hashchange` listener after the ledger renders so in-page navigation behaves like initial load. Preserve unrelated disclosure state unless it blocks the requested target.

Defer media attachment until a containing disclosure is open and the media approaches the viewport. On `toggle`, observe newly revealed `[data-src]` elements only inside the opened disclosure; never attach sibling case media.

- [ ] **Step 5: Add fetch retry without duplicating handlers**

Keep the retry button hidden after successful load. On fetch failure, reveal the fallback and retry control. The retry handler calls the same guarded ledger-load function, disables itself while pending, and is registered once. Featured proof, selector state, and pilot safeguards must remain intact through failure and retry.

- [ ] **Step 6: Run all VIPS behavior tests**

```bash
node --test \
  test/unit/vips-pitch-data-model.test.js \
  test/unit/vips-pitch-render.test.js \
  test/vips-pitch-data.test.js \
  test/vips-pitch-page.test.js \
  test/vips-pitch-e2e.test.js \
  test/vips-pitch-release.test.js
```

Expected: all VIPS tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js test/vips-pitch-page.test.js
git commit -m "feat: add VIPS decision and evidence interactions"
```

---

### Task 5: Release Verification and Customer-Readiness Review

**Files:**
- Modify: `test/vips-pitch-e2e.test.js`
- Do not modify evidence, assets, headers, or publication state.

**Interfaces:**
- Verifies the complete static page and release package; produces no new runtime API.

- [ ] **Step 1: Add the final static-delivery assertions**

Extend the existing static HTTP test so the fetched `/` response is decoded and checked for the decision controls:

```js
const pageResponse = await fetch(`${baseUrl}/`);
assert.equal(pageResponse.status, 200);
const pageHtml = await pageResponse.text();
assert.match(pageHtml, /id="workflow-selector"/);
assert.match(pageHtml, /id="copy-pilot"/);
assert.match(pageHtml, /id="ledger-retry"/);
```

Keep the existing asset enumeration and traversal rejection intact.

- [ ] **Step 2: Run the bounded VIPS gates**

```bash
npm run test:vips-pitch:coverage
node --test test/vips-*.test.js test/unit/vips-pitch-*.test.js
npm run check
npm run security:scan
npm audit --audit-level=high
git diff --check
```

Expected: all tests pass, coverage is at least 80% in every category, syntax/security checks pass, audit reports no high-severity vulnerability, and the diff has no whitespace errors.

- [ ] **Step 3: Run broader regression tests and separate unrelated failures**

```bash
npm test
npm run test:pitches
```

Expected: repository tests pass. If the pre-existing untracked REVOLVE PDP test still fails because its page is absent, record that exact unrelated failure and rerun the bounded VIPS suite; do not modify or delete the unrelated file.

- [ ] **Step 4: Perform desktop browser acceptance checks**

Serve the artifact locally:

```bash
python3 -m http.server 4173 --directory deploy/brand-pitches/vips/human-reviewed-ecommerce
```

At 1366 × 768 and 1920 × 1080 verify: hero proof intersects the first viewport; exactly three proof examples lead; selection count and fourth-choice rejection work; copying three choices succeeds; chapter hashes do not mass-open cases; case and attempt hashes reveal only required ancestors; fullscreen video remains contained; there is no horizontal overflow or console warning.

- [ ] **Step 5: Perform mobile and accessibility acceptance checks**

At 320 × 768 and 768 × 1024 verify: no horizontal overflow; workflow rail collapses 1/2 columns; all controls are at least 44px; keyboard-only selection/copy/disclosure works; visible focus remains; 200% zoom remains usable; reduced motion disables nonessential motion; mobile requests only the hero poster before scrolling.

- [ ] **Step 6: Exercise failure paths**

Block `data/cases.json` and verify the page retains hero, selector, and safeguards while offering retry. Deny Clipboard API access and verify the manual-copy textarea contains the exact pilot summary and receives selection. Restore access and verify retry renders all five chapters and 29 cases without duplicate handlers.

- [ ] **Step 7: Request code and security reviews, then fix critical/high findings**

Dispatch the code-reviewer and security-reviewer roles over the final diff. Re-run the bounded VIPS suite after any correction. Do not proceed while a critical or high finding remains.

- [ ] **Step 8: Commit final verification assertions**

```bash
git add test/vips-pitch-e2e.test.js
git commit -m "test: verify VIPS decision pitch"
```

- [ ] **Step 9: Report the local artifact and release boundary**

Report the final local page path, commits, bounded and broad test results, browser viewport results, coverage, and any unrelated test failure. State explicitly that no public deployment, customer communication, analytics, paid generation, or external system mutation occurred.
