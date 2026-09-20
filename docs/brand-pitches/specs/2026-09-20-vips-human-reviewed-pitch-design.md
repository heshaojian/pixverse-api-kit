# VIPS Human-Reviewed Ecommerce Pitch Page Design

## Goal

Create a Chinese-first, private-preview pitch page that converts the human-reviewed VIPS ecommerce test document into a concise decision experience without discarding its evidence, retries, limitations, or comparison detail.

The page asks VIPS ecommerce, creative, and AI stakeholders to select three priority ecommerce workflows for a controlled production pilot.

## Governing Standard

The page follows `docs/brand-pitches/playbook.md`:

- Show customer-specific proof before explaining PixVerse.
- Serve one primary audience, one requested decision, and one primary action.
- Separate verified evidence, reviewer judgment, and proposed next steps.
- Use official product sources and approved media without implying an official endorsement.
- Keep internal identifiers, credentials, private paths, and operational debugging material out of the deployable page.
- Default to a private, `noindex` preview until brand, legal, asset, and publication approvals are recorded.

## Audience And Decision

**Primary audience:** VIPS ecommerce content, creative production, and AI capability leaders.

**Requested decision:** Select three priority ecommerce workflows for a controlled production pilot.

**Primary action:** `选择试点工作流`

The action moves the reader to the pilot section and presents the five reviewed workflow families as a short selection discussion, not a commitment form or external submission.

## Source Of Truth

The reviewed Lark document at `YEE4dcLZAoiZC9x9vhzcZKLknsc`, revision `1214`, is the content and evidence source for this page.

The source contains five workflow families and twenty-nine test rows:

1. Viral-video recreation and single-shot editing: eleven rows.
2. Presenter-led product selling: three rows.
3. Creative commercial effects: three rows.
4. Product-page motion: nine rows.
5. Outfit generation: three rows.

Each row may contain multiple output variants, retries, or model/workflow comparisons. The conversion must retain those distinctions rather than treating each row as one undifferentiated result.

The page must preserve reviewer language faithfully while allowing light copy editing for consistency, brevity, and Chinese-first presentation. A condensed statement must never reverse or strengthen the source verdict.

## Information Architecture

### 1. Compact Header

- Customer context appears first.
- PixVerse identity is present but visually secondary.
- Use an official VIPS wordmark only if a first-party, publication-safe asset is available and its use is appropriate for the private preview.
- If an approved VIPS wordmark cannot be obtained, use a neutral page title without recreating or approximating the logo.
- Include navigation links for `重点结果`, `能力总览`, `完整评审`, and `建议试点`.

### 2. Proof-First Hero

Headline:

> 真实商品，真实测试，人工评审

Supporting copy explains that the page organizes reviewed VIPS examples across advertising, product-detail, and outfit-generation scenarios.

The first viewport contains three strong, materially different proof examples:

- Presenter-led product selling through Growth Studio Agent.
- Creative commercial production through PixVerse Agent.
- Controlled product-page motion with product consistency constraints.

The hero does not lead with model names, generation settings, generic AI claims, or unsupported business pain points.

### 3. Capability Overview

Provide a scan-friendly summary of the five workflow families using explicit text verdicts:

- `可胜任`
- `部分胜任`
- `当前不建议直接使用`

Status is never communicated by color alone. Each summary also states the principal reason for its verdict and links to the supporting review section.

### 4. Human-Reviewed Evidence Ledger

The evidence ledger is the page's signature interaction. It has five chapters corresponding to the reviewed workflow families.

Each chapter contains:

- A concise capability verdict.
- The best representative result.
- What the workflow does well.
- Known limitations and unsafe assumptions.
- Recommended operating conditions.
- An expandable list containing every source test row.

Each test entry contains, when present in the source:

- Test title and stable page-local identifier.
- Original video, product page, or reference imagery.
- Requested outcome.
- Compared workflow or model labels.
- Generated videos and images.
- Parameters that materially affect interpretation, such as duration, aspect ratio, resolution, sound, or subtitle treatment.
- Retry or prompt-adjustment history.
- Human-reviewed observations, including timestamps for visible defects.
- Final verdict.

Detailed prompt text is placed inside a secondary `评审详情` disclosure. It is available for audit but does not compete with the product proof or customer decision.

Native disclosure controls are preferred so keyboard and no-framework behavior remain reliable. Opening one test does not close another, allowing reviewers to compare cases.

### 5. Capability Boundaries

Summarize the cross-case lessons supported by the reviewed evidence:

- Strong now: restrained product motion, outfit visualization, and straightforward product presentation.
- Workflow-dependent: presenter-led selling, functional demonstrations, viral-video adaptation, and creative advertising.
- Higher risk: small readable text, exact logos, complex hand interactions, multi-step physical demonstrations, and background replacement that must preserve every foreground detail.

These statements are review conclusions, not universal product guarantees.

### 6. Controlled Pilot Proposal

The closing proposal asks VIPS to select three of the five reviewed workflow families.

The pilot section proposes that both teams jointly confirm:

- Priority products and approved source assets.
- Channel and target format for each workflow.
- Product details that must remain exact.
- Human-review scorecard and critical-failure rules.
- Acceptance rate, review time, and regeneration limits.

No unapproved duration, volume, price, SLA, or success threshold is presented as agreed commercial fact.

### 7. Disclaimer And Provenance

The footer states that the page is a private capability proposal based on reviewed test materials and does not represent a public VIPS endorsement.

It includes the source revision and page review date without exposing private Lark tokens, local paths, job IDs, or credentials.

## Visual Direction

### Customer-Led Composition

The composition should feel like a premium ecommerce review room rather than a generic AI landing page:

- Product footage is the dominant visual material.
- The canvas remains dark and restrained in accordance with the PixVerse design system.
- Depth uses translucent white layers and blur, not decorative shadows.
- Status colors appear only with a text label and icon.
- The PixVerse create gradient is reserved for the single primary action.
- Decorative gradient orbs, sparkles, stock imagery, nested cards, and generic metric walls are excluded.

### Typography And Tokens

- Use Plus Jakarta Sans for the interface and Chinese system sans-serif fallbacks for legible Chinese rendering.
- Use Inconsolata only for aligned counts, timestamps, durations, or other review data.
- Consume the canonical PixVerse background, text, border, status, spacing, radius, and gradient values through local CSS custom properties mapped directly from `pixverse-design-system/DESIGN.md` version `1.0.1`.
- Do not invent additional brand gradients or approximate customer brand colors.

### Signature Element

The human-review ledger uses a quiet vertical evidence spine. Each test attaches a textual verdict, its source/product input, and its reviewed output to the same spine. This visualizes traceability rather than decorating the page with arbitrary numbered cards.

### Responsive Composition

- Desktop uses a bounded reading column plus a sticky chapter navigator where space permits.
- Mobile collapses navigation into a horizontally scrollable section bar and renders evidence in a single column.
- All controls meet a minimum 44-pixel touch target.
- Portrait video uses a stable source aspect ratio, centered `object-fit: contain`, and the same policy in fullscreen.
- Landscape and square media retain their own source ratio and are never cropped merely to make cards uniform.
- Reduced-motion preferences disable nonessential reveal transitions.

## Content Model

The deployable page reads a static `cases.json` file. The schema separates customer-facing summary content from expandable review evidence.

```json
{
  "schemaVersion": "vips-pitch.v1",
  "source": {
    "documentId": "YEE4dcLZAoiZC9x9vhzcZKLknsc",
    "revisionId": 1214,
    "reviewedAt": "2026-09-20"
  },
  "chapters": [
    {
      "id": "presenter-commerce",
      "title": "真人带货",
      "verdict": "partially-capable",
      "summary": "中文评审摘要",
      "strengths": ["证据支持的优势"],
      "limitations": ["证据支持的限制"],
      "cases": [
        {
          "id": "presenter-outerwear",
          "title": "运动外套",
          "request": "原始产出要求",
          "inputs": [],
          "attempts": [],
          "review": {
            "verdict": "partially-capable",
            "summary": "人工评审结论",
            "observations": []
          }
        }
      ]
    }
  ]
}
```

The production data contains concrete values only. The example above defines shape; it is not deployable content.

### Media Records

Each media record contains:

- Stable local identifier.
- Media type.
- Customer-facing label.
- Local public-safe asset path or first-party HTTPS source.
- Dimensions or aspect ratio when known.
- Descriptive alternative text or video motion description.
- Source classification: original input, reference image, generated attempt, or approved result.

Generated Lark attachments required for the review are downloaded into the private preview artifact. They are not hotlinked through authenticated Feishu URLs. Existing first-party VIPS product and media URLs may remain external when they are HTTPS, stable, and appropriate for the preview.

## File Architecture

```text
deploy/brand-pitches/vips/human-reviewed-ecommerce/
  index.html                 semantic page shell and featured proof fallback
  styles.css                 PixVerse-token-based responsive presentation
  app.js                     data loading, chapter navigation, and media fallback
  data/
    cases.json               complete reviewed content model
  assets/
    brand/                   approved customer and PixVerse assets
    images/                  local review imagery and posters
    videos/                  local generated evidence videos
  _headers                   private-preview security and indexing headers
```

No file should exceed 800 lines. Data conversion helpers, if needed, live outside the deploy directory under `scripts/` and are not shipped to the customer page.

## Loading And Failure Behavior

- The three featured proof items render in the HTML shell so the page still establishes value if JavaScript fails.
- Remaining evidence loads from `cases.json` after the core page is interactive.
- Only the first featured video uses `preload="metadata"`; all other videos use `preload="none"`.
- Posters and detailed media are assigned shortly before their section enters the viewport.
- A missing video shows its label, review text, and a clear `视频暂不可用` state instead of a black rectangle.
- A failed data request leaves the featured proof and pilot proposal usable and displays a short recovery message for the evidence ledger.
- Product and source links remain ordinary links and do not depend on JavaScript.

## Accessibility

- Semantic landmarks and headings follow the visible reading order.
- Every video has an accessible name and meaningful motion description.
- Every meaningful image has accurate Chinese alternative text.
- Disclosure controls expose their expanded state and remain keyboard-operable.
- Focus indicators are visible on every interactive element.
- Status includes text and iconography, not color alone.
- The page is usable at 200% zoom and at a 320-pixel viewport.
- Long prompts wrap safely without creating horizontal overflow.

## Security And Privacy

- The page performs no billable requests and contains no generation credentials.
- The release folder contains no local filesystem paths, internal job IDs, access tokens, or private reviewer identity.
- External links opened in a new tab use `rel="noreferrer"`.
- `_headers` sets a restrictive content security policy compatible with the static asset set, `X-Content-Type-Options: nosniff`, a strict referrer policy, and framing restrictions.
- Page metadata and headers prevent search indexing for the private preview.
- No analytics are included in the first implementation.

## Testing And Acceptance

### Automated Tests

- Confirm `cases.json` validates against the expected schema.
- Confirm five chapters and twenty-nine source test rows are present.
- Confirm every referenced local asset exists.
- Confirm every case has a request, a reviewer verdict, and at least one input or output reference.
- Confirm the page includes one primary action and the required pilot decision language.
- Confirm `noindex`, security headers, semantic landmarks, accessible video labels, disclosure controls, and external-link protections.
- Confirm no local paths, credentials, Lark attachment tokens, or internal job identifiers appear in the deploy directory.
- Confirm all product-fidelity videos use centered `contain` behavior inline and fullscreen.

### Browser Review

- Verify the strongest proof is visible without scrolling at desktop and mobile sizes.
- Verify chapter navigation, deep links, disclosures, keyboard interaction, focus states, and media fallbacks.
- Verify no horizontal overflow at 320, 390, 768, 1280, and 1920 pixels.
- Verify 200% zoom and reduced-motion behavior.
- Verify initial media requests stay within the visible-first loading budget.
- Inspect at least one portrait, landscape, and square example in inline and fullscreen playback.

### Content Review

- Compare all twenty-nine page cases with Lark revision `1214`.
- Confirm condensed summaries preserve the original verdict and limitations.
- Confirm every output shown as approved or usable has human-reviewed evidence supporting that label.
- Confirm model and workflow comparisons remain factual and do not imply unsupported universal superiority.
- Confirm no private or internal-process language appears in the executive layer.

## Release Boundary

This implementation ends at a verified local private-preview artifact. It does not authorize public deployment, customer distribution, analytics, external uploads, or paid generation. Those actions require separate approval and the playbook's preview, approval, and production release gates.

