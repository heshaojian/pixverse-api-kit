# VIPS Complete Product Gallery Design

## Objective

Correct the customer-facing proof structure so the page visibly presents three featured product-video examples, with each video's product information in the same card, and add a complete inventory of every product case in the original human-reviewed VIPS document.

The page remains a private, access-controlled preview. This revision changes presentation and catalog completeness; it does not authorize public deployment, new media generation, or invented product links.

## Source Boundary

The authoritative source is the original human-reviewed Feishu document `YEE4dcLZAoiZC9x9vhzcZKLknsc`, revision `1214`, represented by the existing reviewed corpus.

The source contains 29 review records:

- 28 product cases that must appear in the complete product gallery.
- 1 prompt-only baseline, `product-motion-prompt-baseline`, which is an evaluation method rather than a product and must not appear as a product card.

The verified product-link document remains the authority for external detail URLs. It supplies ten case mappings covering nine unique VIPS detail pages. Cases without a verified URL remain link-free; the page must not infer or invent a URL.

## Approved Page Structure

### 1. Hero

Keep the customer-specific headline and short decision framing. Remove the standalone hero proof card so it is no longer implicitly counted as one of three examples outside the featured section.

The hero should lead directly into the featured proof group without duplicating a demo.

### 2. Three Featured Product-Video Cards

The featured section must visibly contain exactly three cards:

1. Pale yellow-green suit multi-pose product motion.
2. Men's jeans presenter-commerce video.
3. Ice-crystal skincare creative commercial.

Each card is one semantic unit containing:

- The video player.
- Product or case name.
- Workflow label and reviewed verdict.
- Short customer-facing review summary.
- Verified VIPS product-detail link only when that exact case has one.

The video and product information must not be separated into different page sections.

The product-motion card is the lead card and spans the full featured width on desktop. The presenter and creative cards follow as two supporting cards. On mobile, all three stack in source order.

Media frames preserve their real aspect ratios:

- Product-motion and presenter videos remain portrait.
- The skincare creative remains landscape at 16:9.
- All players use centered `object-fit: contain` inline and fullscreen.
- No video is cropped merely to make the cards visually uniform.

Only the skincare featured case receives the verified product-detail link. The other two featured cases retain product information from the reviewed source but receive no invented URL.

### 3. Complete Product Gallery

Replace the current ten-link directory with a complete `全部评审商品` gallery containing all 28 product cases from the source corpus.

Group cards in original workflow order:

1. Viral recreation and single-shot editing.
2. Presenter commerce.
3. Creative commercial.
4. Product motion.
5. Outfit generation.

Every gallery card includes:

- Product/case title.
- Workflow name.
- Reviewed verdict.
- Media readiness status.
- A link to the matching evidence record in the page.
- A verified VIPS product-detail action when available.

Media readiness is derived only from reviewed evidence:

- `已有视频` when the case contains at least one reviewed video.
- `已有图片，视频待补充` when it has image evidence but no reviewed video.
- `视频待补充` when it has neither reviewed video nor a suitable image preview.

Cases without video stay visible. Their card must use a neutral, explicit placeholder rather than a broken player or an empty black rectangle.

The gallery is an inventory and navigation surface, not a wall of 28 eager video players. Existing videos are reached through the featured proofs or evidence link; this protects page speed and keeps missing-video cases visually equal. Later video additions can change the readiness state without changing the catalog structure.

## Data And Rendering

Add an immutable product-catalog selector derived from the validated corpus. It must:

- Preserve chapter and case order.
- Return exactly 28 records.
- Exclude only the prompt-only baseline.
- Retain cases with zero video media.
- Include the first appropriate image preview when one exists.
- Include a verified product URL only when it belongs to the case.
- Return a stable evidence anchor for every record.

Each record exposes the minimum presentation model:

```js
{
  chapterId,
  chapterTitle,
  caseId,
  caseTitle,
  verdict,
  mediaStatus,
  previewImage,
  productUrl,
  evidenceHref
}
```

All returned arrays and records remain frozen. URLs continue through the existing strict VIPS product-link validator. Customer-visible text remains escaped.

## Copy Corrections

The featured heading may state `三条重点商品视频` only when all three cards are present inside that section.

Do not count a proof from another section. Do not use wording such as `先看三条` above a two-card grid.

The complete gallery heading should communicate completeness and future supplementation without implying all products already have video, for example:

> 全部评审商品

Supporting copy:

> 原始评审文档中的 28 条商品案例均保留在此；已有视频可进入评审，暂缺视频的商品将在后续补充。

## Responsive Design

- Desktop: one full-width lead proof, followed by two supporting proof cards; catalog uses a restrained multi-column grid.
- Tablet: featured cards and catalog reduce columns without changing reading order.
- Mobile: every proof and product card becomes a single-column unit with product information directly below its media.
- Landscape and portrait videos reserve source-appropriate frames.
- No horizontal overflow at 320 pixels.
- All links and controls retain at least 44-pixel touch targets and visible focus.

## Accessibility And Resilience

- Keep semantic headings, landmarks, video labels, and keyboard access.
- Status text must be explicit; color is never the only signal.
- Missing-video placeholders must explain `视频待补充`.
- Product and evidence links remain usable without media playback.
- The three featured product descriptions remain available in static HTML without JavaScript.
- The complete catalog may progressively enhance from validated local data, with a useful fallback sentence.

## Performance And Privacy

- Keep one metadata-loaded lead video and defer the two supporting videos.
- Do not add 28 eager players or generate new posters in this revision.
- Keep `noindex`, CSP, referrer policy, and existing private-preview protections.
- Do not expose either Feishu document token under `deploy/`.
- Do not add analytics, cookies, public social metadata, external scripts, or billable generation.

## Verification

Automated tests must prove:

- Exactly three featured product-video cards exist in the featured section.
- Every featured card contains both video and product information.
- The landscape skincare video is reserved at 16:9 and is not forced into 9:16.
- The complete gallery contains exactly 28 product cases in source order.
- The prompt-only baseline is excluded from the gallery but remains in the complete evidence ledger.
- Cases without video remain present with an explicit pending status.
- Ten case mappings still resolve to nine unique verified VIPS product-detail URLs.
- Every gallery card links to its evidence record.
- Existing private-release, security, accessibility, coverage, and responsive checks remain green.

Browser review covers 320×768, 768×1024, 1366×768, and 1920×1080, including mixed video orientation, three-card counting, catalog completeness, missing-video states, keyboard focus, and horizontal overflow.

## Out Of Scope

- Generating or sourcing missing videos.
- Inventing product names, SKUs, detail URLs, or claims not present in the reviewed sources.
- Treating the prompt-only baseline as a product.
- Public deployment, analytics, CRM activity, or external messaging.
