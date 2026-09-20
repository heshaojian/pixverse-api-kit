# VIPS Decision Pitch Page Design

## Objective

Turn the existing VIPS human-reviewed ecommerce page into a short, Chinese-first decision experience for an ecommerce or creative leader. The page must show credible product proof immediately, help the reader choose three workflows for a controlled pilot, and preserve all 29 reviewed cases without placing raw implementation detail in the executive path.

The existing evidence corpus, media, review verdicts, source revision, review date, private-preview posture, and non-endorsement disclaimer remain authoritative. This project changes presentation and interaction hierarchy; it does not rewrite review outcomes or invent customer priorities.

## Primary Reader and Decision

- **Primary reader:** VIPS ecommerce, merchandising, or creative lead evaluating practical video workflows.
- **Requested decision:** Select three of five reviewed ecommerce workflows for a controlled pilot.
- **Primary action:** Confirm the three-workflow pilot selection by copying a concise, shareable pilot summary.
- **Secondary action:** Inspect the complete human-review evidence ledger.

## Chosen Direction

Use an evidence-first executive page with a progressive-disclosure appendix.

The rejected alternatives are:

- A report-first page, because test methodology and raw generation history would dominate the customer decision.
- A two-mode decision/report switch, because it adds navigation and state complexity without improving the single requested decision.

## Information Architecture

### 1. Compact proof hero

The first viewport contains both the decision thesis and a real featured video. It must not use a full-viewport text-only hero.

- Outcome-led headline: “从真实商品样例中，选择三条最值得试点的电商视频工作流”.
- Supporting copy explains that the page is based on 29 human-reviewed test rows across five workflows.
- Primary action moves to the workflow selector.
- Secondary action moves to the full evidence ledger.
- A featured product-motion video is visible without scrolling at a 1366 × 768 desktop viewport.
- Source revision and review date remain visible but subordinate.

### 2. Three featured proofs

Keep the three existing featured examples:

1. Presenter commerce: men’s jeans.
2. Creative commercial: ice-crystal skincare concept.
3. Product motion: pale yellow-green suit motion loop.

Each proof contains the video, verdict in text and symbol, product or concept name, one business-use sentence, and one explicit boundary where applicable. No prompt, model, credit, job, or retry metadata appears here.

### 3. Five-workflow pilot selector

The five reviewed workflows become selectable decision cards:

- Viral remix and single-shot editing.
- Presenter commerce.
- Creative commercial.
- Product motion.
- Outfit generation.

Selection behavior:

- Zero to three cards may be selected.
- The UI always states the current count as text, for example “已选择 2 / 3”.
- A fourth selection is rejected with an inline explanation rather than silently replacing another choice.
- Selected state uses label, icon, border, and text; color is not the only signal.
- The primary “复制试点方案” action is enabled only when exactly three workflows are selected.
- The copied summary names the three workflows, the common pilot safeguards, the source revision, and the review date.
- Copy success and failure are announced in an accessible status region.
- No message is sent and no external system is modified.

### 4. Pilot safeguards

The existing four-item pilot checklist remains, reframed as the shared operating contract for the selected workflows:

- Confirm priority products, approved source assets, and channel formats.
- Define exact product details, text, logos, and motion boundaries.
- Agree on human-review criteria, critical-failure rules, and retry limits.
- Compare output quality, review time, and rework causes using one scorecard.

### 5. Complete evidence appendix

Preserve all five chapters, 29 cases, inputs, outputs, attempts, observations, prompts, and review conclusions. Reorder disclosure into three levels:

1. **Chapter:** verdict, strengths, limitations, and concise operating conditions.
2. **Case summary:** request, verdict, review summary, key observations, and evidence media.
3. **Complete review record:** attempt methods, parameters, prompts, retries, per-attempt observations, and supporting media.

All chapters and cases are collapsed by default. Chapter hashes scroll to the chapter without opening every descendant. Case hashes open only the target case and its ancestor context. Attempt hashes additionally open the complete review record containing that attempt. Hash changes after initial load follow the same rules.

## Visual Direction

Use the PixVerse v1.0.1 design system as the single token source.

- Pure black canvas with white-alpha depth and no decorative shadows.
- Plus Jakarta Sans for UI text and Inconsolata only for aligned numeric counts.
- White 100% / 60% / 40% text hierarchy.
- One create-gradient action: “复制试点方案”.
- Secondary actions use translucent white fills and blur.
- Controls use the documented 8–12px radius family; panels use 16px.
- Status colors always appear with text and a symbol.
- No decorative AI motifs, gradient orbs, approximate VIPS logo, or unapproved customer asset.

The signature visual is a retail-assortment-style workflow rail: five compact decision cards form one continuous selection surface, and the selected three assemble into a concise pilot summary directly beneath it. This expresses the customer’s merchandising context without copying protected brand assets.

## Responsive Behavior

- At 1366 × 768 and wider, hero copy and featured proof share the first viewport.
- At narrow widths, the featured video follows the headline and remains visible early in the page.
- The workflow selector is a five-column rail on wide screens, a two-column grid on tablets, and a single-column list on phones.
- All touch targets are at least 44px.
- Inline and fullscreen product media use centered `object-fit: contain`.
- Media dimensions or aspect ratios are reserved before loading.
- The page has no horizontal overflow at 320px, 768px, 1366px, or 1920px.

## Accessibility and Interaction

- Preserve semantic landmarks, ordered headings, the skip link, keyboard operation, and visible focus.
- Selection cards are real form controls with explicit labels and a fieldset legend.
- Copy-result announcements use a polite live region.
- Details and summaries remain keyboard accessible.
- Reduced-motion preferences disable nonessential transitions.
- Status and selection are never communicated through color alone.

## Performance and Failure Handling

- The hero video keeps a deliberate poster and metadata preload.
- Only the intended initial poster budget loads: one on mobile, up to three on desktop.
- Non-featured videos remain `preload="none"` until their disclosure is opened near the viewport.
- Expanding one case must not load media belonging to unrelated cases.
- Image width and height are emitted from the validated data when available.
- When clipboard access fails, the page exposes the generated summary in a selectable text area and explains how to copy it manually.
- When the ledger fails to load, featured proof, workflow selection, and pilot safeguards remain usable, with a retry control for the ledger.

## Security and Publication

- Keep `noindex`, the restrictive content-security policy, clickjacking protection, and private-proposal disclaimer.
- Keep external links HTTPS-only with `rel="noreferrer"`.
- Do not add analytics, customer data, local paths, private URLs, secrets, API calls, or billable generation actions.
- Do not present the page as a public VIPS endorsement or partnership.
- Public deployment remains out of scope until brand/legal approval, safe-to-forward review, expiry ownership, and takedown ownership are recorded.

## Code Boundaries

- `index.html` owns static structure, hero proof, selector mount, pilot safeguards, fallback content, and metadata.
- `styles.css` owns design-system tokens, responsive composition, selection states, disclosure hierarchy, focus, and reduced motion.
- `data-model.js` owns validation and immutable normalized pitch data.
- `render.js` owns pure markup generation for chapters, case summaries, and complete review records.
- `app.js` owns initialization, deferred media, hash targeting, workflow-selection state, clipboard behavior, live announcements, retry behavior, and failure recovery.
- Existing tests are extended rather than replaced. No new runtime dependency is required.

## Test Strategy and Acceptance Criteria

Implementation follows red-green-refactor.

### Unit tests

- Rendered case markup keeps prompts and attempt parameters inside the nested complete-review disclosure.
- Images include validated intrinsic dimensions.
- Selection state is immutable and enforces the three-item maximum.
- Pilot-summary output is deterministic and contains the selected labels, safeguards, revision, and date.
- Deep-link resolution opens only the required chapter, case, and attempt ancestors.

### Integration and release tests

- All five workflows render as labeled selectable controls.
- The copy action is disabled until exactly three selections are made.
- Existing 29-case and five-chapter completeness assertions continue to pass.
- No prompt, model, job ID, credit amount, or retry detail appears in the featured or selector layer.
- Private-preview headers and no-secret scans remain green.
- Relevant VIPS page, render, data, E2E, release, syntax, and security tests pass with at least 80% coverage for the covered VIPS modules.

### Browser checks

- At 1366 × 768, real video proof intersects the initial viewport.
- At 320px, no horizontal overflow occurs and all controls remain usable.
- Selecting three workflows enables copy and produces an accessible success state.
- A fourth selection is prevented with a visible explanation.
- Direct chapter links do not mass-open cases.
- Direct case and attempt links reveal only the required evidence.
- No console error or warning appears during the critical flow.

## Out of Scope

- Changing the reviewed verdicts or source evidence.
- Generating new paid media.
- Adding customer logos or proprietary brand assets without approval.
- Sending the pilot selection to email, CRM, Lark, or another external service.
- Publishing or deploying a public customer URL.
