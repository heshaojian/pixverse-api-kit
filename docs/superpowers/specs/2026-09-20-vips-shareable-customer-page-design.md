# VIPS Shareable Customer Page Design

## Objective

Upgrade the existing Chinese-first VIPS decision pitch into a customer-ready private preview that can be shared directly with VIPS stakeholders. The page must make the customer identity explicit, expose verified VIPS product-detail links where the source documents provide them, preserve the reviewed evidence, and lead to one controlled pilot decision.

This remains a private or access-controlled customer preview. Public deployment, unrestricted forwarding, analytics, and claims of partnership or endorsement remain out of scope.

## Chosen Approach

### Recommended: customer-ready private preview

Use a compact co-brand lockup, customer-facing language, verified product links, measurable pilot criteria, and private-safe share metadata. Keep the complete 29-case review ledger as an appendix.

This option best matches the Pitch Page Playbook because it improves customer recognition and decision clarity without turning the evidence page into a public marketing claim.

### Alternative considered: evidence-led internal review

Keep the current neutral header and expose product links only inside the evidence ledger. This minimizes brand-asset work but does not feel intentionally prepared for VIPS and fails the playbook's co-branding standard.

### Alternative considered: public campaign page

Add public social previews, analytics, a canonical public URL, and freely forwardable branding. This requires brand/legal approval, customer approval where applicable, access and retention decisions, expiry ownership, and a takedown plan. It is not authorized for this iteration.

## Source Authority

Two Feishu documents serve different purposes:

- Human-reviewed outcome source: document `YEE4dcLZAoiZC9x9vhzcZKLknsc`, revision `1214`.
- Product-link source: document `L6sbdC5j3obuDoxrpcYcwGySn2e`, revision `5`.

The product-link source contains ten case-to-product mappings covering nine unique `https://detail.vip.com/` URLs. The duplicated URL is legitimately used by two different cases. Product-motion and outfit-generation rows contain reference images but no product-detail URLs; the page must not invent links for those rows.

The existing case corpus already contains the ten matching case-level links. The implementation will record the second document and revision in source provenance, verify exact mapping in tests, and render the links in customer-facing locations.

## Audience And Decision

- Primary reader: VIPS ecommerce, merchandising, creative-production, or AI-capability lead.
- Requested decision: select three of five reviewed ecommerce workflows for a controlled pilot.
- Primary action: copy the selected three-workflow pilot brief.
- Secondary actions: open a verified VIPS product page or inspect the complete human-review evidence.

## Customer-Facing Story

### Header

Create one compact co-brand group:

1. A locally hosted raster icon derived from the first-party `https://www.vip.com/favicon.ico`, with source and checksum recorded.
2. The neutral customer label `唯品会`, presented as text rather than an imitation wordmark.
3. A visible multiplication separator.
4. The existing approved PixVerse mark and name, at secondary visual weight.

Use the VIPS identity once. Do not repeat it in badges, backgrounds, or section headings. Keep the PixVerse favicon for the PixVerse-hosted private pitch and add a local Apple touch icon.

### Headline And Hero

Use a literal VIPS-specific headline:

> 为唯品会真实商品，选择三条最值得试点的视频工作流

Keep the reviewed product-motion proof in the first viewport. Supporting copy explains that the page combines human-reviewed results with verified VIPS product pages, without claiming a public partnership or endorsement.

### Featured Proof

Keep the three approved, materially different proofs:

- Product motion: pale yellow-green suit multi-pose loop.
- Presenter commerce: men's jeans.
- Creative commercial: ice-crystal skincare.

Replace implementation language such as `Agent 完整表达` with customer-facing output language such as `成片完整表达`. Add a visible `查看唯品会商品详情` action to a featured proof only when that exact case has a verified detail URL. The creative skincare proof receives the link; the product-motion and presenter proofs do not because their source rows provide no product-detail page.

### Product Link Directory

Add a compact `本次评审商品` section after the featured proofs and before workflow selection. It lists the ten mapped cases grouped by workflow and links to the nine unique VIPS product pages. Each entry includes:

- Customer-facing case title.
- Workflow label.
- `查看唯品会商品详情` external link.

Where two cases share one product URL, keep both case entries so the relationship to the reviewed evidence remains clear. Links open in a new tab, use HTTPS only, and set `rel="noreferrer"`.

### Pilot Close

Retain the existing operating safeguards and add proposed, observable pilot measures:

- Product-fidelity approval rate.
- Time from approved source assets to review-ready output.
- Number of outputs accepted for a selected channel test.
- Repeatable creative patterns identified during the pilot.

Frame these as criteria to confirm jointly, not guaranteed targets. The copy action remains the only gradient primary action.

### Evidence Appendix

Preserve all 29 reviewed cases, attempts, observations, verdicts, and media. Case summaries surface the verified product-detail link before the nested complete-review record. Prompts, model names, retry detail, and parameters remain inside the deepest disclosure.

## Share Experience

Because this is a private customer preview:

- Keep `noindex, nofollow`.
- Keep the private-proposal and non-endorsement disclaimer.
- Add a descriptive title and meta description that name VIPS and the pilot decision.
- Add a local Apple touch icon.
- Do not add a customer-specific Open Graph image or public canonical URL until a deployment URL and approval are available.
- Do not add analytics, cookies, tracking parameters, or external scripts.

The implementation must remain safe to forward within the intended customer group, while acknowledging that access control cannot prevent screenshots or downloaded media.

## Data And Rendering

Extend the existing `source` record with a typed `productLinkSource` object:

```json
{
  "documentId": "L6sbdC5j3obuDoxrpcYcwGySn2e",
  "revisionId": 5,
  "verifiedAt": "2026-09-20"
}
```

Add immutable selectors that:

- Extract case-level `detail.vip.com` inputs.
- Preserve chapter and case order.
- Return ten mappings and nine unique URLs.
- Reject non-HTTPS, query-bearing, fragmented, or non-`detail.vip.com` product links.
- Expose a product link for a featured case only when the link belongs to that case.

Rendering remains escaped and deterministic. No product link is inferred from image URLs, product titles, SKU-like text, or neighboring rows.

## Brand Asset Handling

The VIPS icon must be downloaded only from the first-party `www.vip.com` origin, then converted to a trusted local raster format. Record its source URL, retrieval date, byte count, dimensions, and SHA-256 checksum. Do not embed the remote icon, retain tracking metadata, or introduce an unsanitized SVG.

The icon is an identity marker, not a claim that the page is an official VIPS publication. The adjacent text remains ordinary UI text, not an imitation wordmark.

## Accessibility And Responsive Behavior

- Give the VIPS icon descriptive alternative text as part of the customer identity; keep decorative separators hidden from assistive technology.
- Preserve the skip link, semantic landmarks, heading order, visible focus, live regions, and 44-pixel targets.
- Keep all product links keyboard accessible with specific labels.
- Keep video media centered with `object-fit: contain` inline and fullscreen.
- Keep the co-brand lockup balanced on desktop and stack it without overflow on narrow screens.
- Preserve reduced-motion behavior and prevent horizontal overflow.

## Security And Privacy

- Keep the restrictive CSP, clickjacking protection, referrer policy, MIME protections, and private-preview documentation.
- Treat `noindex` as indexing guidance, not access control.
- Do not publicly deploy without an authenticated or otherwise approved distribution path.
- Do not expose Feishu document URLs or tokens in customer-visible markup.
- Do not add credentials, internal paths, job IDs, billable generation, or customer-specific analytics.

## Verification

Automated tests must prove:

- The product-link provenance matches document revision 5.
- Exactly ten cases map to nine unique approved VIPS product-detail URLs.
- Only matching featured cases receive a visible product link.
- Every rendered product link is HTTPS, on `detail.vip.com`, query-free, fragment-free, and `noreferrer`.
- The co-brand header uses the local first-party-derived VIPS icon and existing PixVerse asset.
- The customer-specific headline and customer-facing copy are present.
- Pilot success criteria are visible and clearly proposed.
- Existing corpus completeness, evidence hierarchy, coverage, syntax, security, and private-release tests remain green.

Browser review covers desktop, tablet, and narrow mobile layouts; first-viewport proof; co-brand spacing; product-link navigation semantics; selector behavior; clipboard success and fallback; deep links; reduced motion; console errors; and horizontal overflow.

## Out Of Scope

- Public deployment or unrestricted public sharing.
- Customer-specific public social preview artwork.
- Analytics, CRM submission, email delivery, or Feishu messaging.
- New paid media generation.
- Inventing product URLs for rows without a source link.
- Using a recreated or approximate VIPS wordmark.
