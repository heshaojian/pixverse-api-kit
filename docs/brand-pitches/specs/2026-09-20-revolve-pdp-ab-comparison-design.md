# REVOLVE 0911 vs PDP Standard/high Comparison Design

**Date:** 2026-09-20

**Status:** Approved design; implementation pending

**Audience:** Internal PixVerse reviewers

**Decision:** Compare the fourteen matched REVOLVE products from the 0911 release against the new PDP Standard/high outputs and record a per-product preference.

## Objective

Replace the current single-output PDP review gallery with a neutral, apples-to-apples comparison experience. Each product must show its 0911 Original video and its PDP Standard/high video at the same size, with the same framing and equivalent controls, so reviewers can judge product fidelity, human motion, framing, and overall readiness without relying on memory.

The comparison remains an internal review artifact. It must not modify, redeploy, or share a release lifecycle with the existing `revolve-pixverse-0911` page.

## Chosen Experience

Use a matched side-by-side review page containing all fourteen products in campaign order.

Each comparison row contains:

1. Product number, brand, product name, color or variant, and SKU.
2. Two equal `9:16` media frames:
   - **A — 0911 Original** on the left.
   - **B — PDP Standard/high** on the right.
3. Shared `Play both`, `Pause both`, and `Restart both` controls.
4. A shared audio selector with `Muted`, `A`, and `B`; `Muted` is the default and only one side may be audible at a time.
5. A four-state reviewer choice: `Prefer A`, `Prefer B`, `Tie`, or `Needs review`.
6. The canonical REVOLVE product link and separate direct-video links for A and B.

The page header shows the review purpose, a completed-choice count such as `6 of 14 reviewed`, and a compact product jump control. All fourteen comparisons remain in the page; the jump control changes scroll position rather than filtering or hiding products.

## Alternatives Considered

### A/B toggle

One player would alternate between the two sources. This is more compact but makes reviewers compare from memory and obscures differences in timing and motion.

### Overview grid with comparison modal

A grid would make the catalog easier to scan, but every meaningful judgment would require opening a modal. It also adds focus-management and state complexity without improving the comparison itself.

### Matched side-by-side — selected

Side-by-side media makes the source, product match, framing, and motion differences visible at once. The longer page is an acceptable trade-off for an internal review whose primary job is careful evaluation.

## Information Architecture

1. Sticky REVOLVE × PixVerse header with `Internal Review` and review progress.
2. Compact introduction stating the comparison criteria and the A/B source mapping.
3. Sticky comparison legend and shared vocabulary:
   - `A — 0911 Original`
   - `B — PDP Standard/high`
4. Fourteen comparison rows in the established campaign order.
5. Footer stating that review choices are stored only in the current browser and that the page is not a customer release.

The first comparison must be visible near the initial desktop viewport. The introduction should not become a marketing hero or push the proof below a large decorative heading.

## Visual Direction

The page should feel like a disciplined edit-review station rather than a campaign gallery.

- Use the PixVerse dark-only system: pure black canvas, Plus Jakarta Sans, white-opacity text hierarchy, white-alpha surfaces, and no decorative shadows.
- Use a quiet vertical seam between A and B as the page's signature visual device. The seam encodes the actual comparison relationship and continues through each desktop pair.
- Keep A and B labels persistent immediately above their corresponding players. Do not rely on color alone to distinguish sources.
- Give both videos identical width, aspect ratio, containment, border, and control treatment.
- Use centered `object-fit: contain` inline and fullscreen. Never crop either product video to fill the frame.
- Reserve status colors for actual media errors or review completion. Do not decorate the page with tier gradients.
- Keep product identity above the pair so both videos clearly belong to the same product.

Desktop presents A and B side-by-side. Below 768 CSS pixels, the pair stacks vertically in A-then-B order while retaining explicit source labels. The center seam becomes a horizontal divider on mobile.

## Data Contract

Upgrade the presentation catalog to a comparison-oriented schema, for example `revolve-pdp-review.v2`. Each product record contains:

- Stable order and SKU.
- Brand, product name, and color or variant.
- Canonical REVOLVE product URL.
- Optional motion description used for accessible context.
- `sources.original0911` with the exact 0911 video URL and a local poster path.
- `sources.pdpStandardHigh` with the exact PDP Standard/high video URL and a local poster path.

The source labels are fixed presentation vocabulary, not inferred from filenames. The 0911 baseline must be labeled `0911 Original`; the page must not claim that those videos used Pro/high or any other unverified generation mode.

The catalog must contain exactly fourteen one-to-one SKU matches. It must not contain API keys, private workspace identifiers, prompts, job IDs, wallet data, absolute local paths, or generation pricing.

## Playback Model

Each row owns an isolated comparison controller. A controller may affect only its own A/B pair.

- Starting a pair pauses any other pair currently playing on the page.
- `Play both` loads both sources if necessary, sets their mute state from the shared selector, aligns both to the earlier of their two current timestamps, and starts them together.
- `Pause both` pauses both sides without changing their positions.
- `Restart both` returns both sides to zero and leaves them paused.
- The browser plays both videos at their natural speed. The implementation must not change playback rate or repeatedly seek one video merely to force equal normalized progress when source durations differ.
- If a user scrubs one native player independently, the pair is no longer assumed to be synchronized until `Restart both` is used.
- `Muted` is the initial audio mode. Selecting A mutes B; selecting B mutes A.
- Native player controls remain available for fullscreen and individual inspection.

This is deliberate best-effort synchronized review, not frame-accurate editorial playback.

## Review State

Review choices are lightweight and local:

- Each product uses one radio-group choice: `Prefer A`, `Prefer B`, `Tie`, or `Needs review`.
- The selected value is stored in versioned `localStorage` under a release-specific key.
- No reviewer name, account, free-text note, timestamp, analytics event, cookie, or remote submission is collected.
- Invalid or stale stored values are ignored safely.
- Review progress counts products with any selected choice; it does not imply approval or readiness.
- A reviewer can change a choice at any time. No aggregate winner or superiority claim is calculated.

## Performance and Loading

The page contains twenty-eight video sources, so media loading must be conservative.

- Use local, deliberately selected poster frames for both sides of every pair.
- Eagerly load only the first desktop pair's two posters; on mobile, eagerly load only the first visible poster.
- Load remaining posters shortly before their pair enters the viewport using `IntersectionObserver`, with a safe no-observer fallback.
- Use `preload="none"` for all videos by default. Metadata may load when a pair approaches the viewport or when the reviewer activates shared playback.
- Do not autoplay any video.
- Do not allow more than one comparison pair to play simultaneously.

## Components and Boundaries

### Comparison catalog

Owns sanitized product identity, source mapping, and poster references. It has no playback or review behavior.

### Comparison row

Owns semantic product markup, equal A/B media presentation, direct links, source labels, and the review radio group.

### Pair controller

Owns shared play, pause, restart, audio selection, media readiness, and pair-local error behavior. It does not know about other catalog records except through a small page-level coordinator that pauses the previously active pair.

### Review store

Validates and reads or writes only the versioned per-SKU preference map. Storage failure must not prevent video review.

### Lazy-media loader

Loads deferred posters and optional metadata without coupling to review choices or playback state.

These boundaries keep catalog data, media coordination, persistence, and rendering independently testable.

## Error Handling

- If one source fails, keep the other source playable and show a concise inline failure state on the unavailable side.
- A failed side retains its direct-video link for manual verification.
- After a load attempt confirms that either source failed, disable shared playback for that pair; individual native playback on the available side remains usable.
- If `play()` is blocked or rejected, leave both videos paused and present a non-modal message instructing the reviewer to use the native controls.
- If a poster fails, show the black media surface and source label without collapsing layout.
- If `localStorage` is unavailable, keep choices usable for the current page session and show no alarming error.
- If the comparison catalog is incomplete or invalid, show a page-level review-unavailable message rather than rendering mismatched products.

Errors must not leak remote response bodies, credentials, internal paths, or provider metadata.

## Accessibility

- Use semantic header, main, section, article, fieldset, legend, button, and footer elements.
- Provide a keyboard-visible skip link and visible focus states.
- Give every video a source- and product-specific accessible label.
- Use real buttons for shared playback and real radio inputs for reviewer choices.
- Maintain a minimum 44-pixel touch target for interactive controls.
- Keep source labels as text; color may supplement but never replace them.
- Announce review-progress changes through a restrained live region.
- Respect `prefers-reduced-motion` and do not add scroll-reveal animation.
- Prevent horizontal overflow at 320, 375, 768, 1280, and 1920 CSS pixels.

## Privacy and Release Isolation

- Preserve `noindex, nofollow, noarchive` metadata and matching response headers.
- Do not add analytics, tracking pixels, cookies, authentication, or remote form submission.
- Do not modify `deploy/brand-pitches/revolve/v4/`.
- Do not deploy to or change `revolve-pixverse-0911`.
- Keep the proposed comparison release isolated under `deploy/brand-pitches/revolve/pdp-review/` and the separate `revolve-pdp-review` Pages project.
- Any public deployment requires a separate explicit approval after local QA.

## Verification

Implementation is complete only when all of the following pass:

1. The catalog contains exactly fourteen unique SKUs in the established campaign order.
2. Every SKU maps to exactly one verified 0911 Original URL and one verified PDP Standard/high URL.
3. The page renders exactly fourteen comparison rows and twenty-eight source-labeled players.
4. Every pair uses identical `9:16` dimensions and centered `contain` framing inline and fullscreen.
5. Shared play, pause, restart, and exclusive audio selection behave correctly for every pair.
6. Activating one pair pauses the previously playing pair.
7. Preference choices persist across a refresh, reject invalid stored values, and never leave the browser.
8. Media, poster, catalog, and storage failures degrade independently without breaking usable content.
9. Initial poster and video requests stay within the documented loading budget on desktop and mobile.
10. Keyboard navigation, focus, labels, radio groups, live progress, reduced motion, and mobile stacking work.
11. The release contains no secrets, private workspace identifiers, job IDs, wallet data, absolute local paths, or generation pricing.
12. Existing API, release-contract, security, and responsive-browser tests pass with at least 80% coverage for new comparison behavior.
13. The original V4 directory remains byte-for-byte unchanged.
14. No deployment occurs during implementation or QA.

## Out of Scope

- Comparing PDP Pro/high against PDP Standard/high.
- Regenerating, editing, transcoding, or billing for any video.
- Free-text annotations, reviewer identity, accounts, remote databases, or team aggregation.
- Automatic scoring, aggregate winners, performance claims, or customer-facing conclusions.
- Publishing or modifying the customer-facing `revolve-pdp.pages.dev` release.
- Changing or redeploying `revolve-pixverse-0911`.
