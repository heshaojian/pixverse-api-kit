# REVOLVE PDP Internal Review Page Design

**Date:** 2026-09-20  
**Status:** Approved for implementation  
**Audience:** Internal PixVerse reviewers  
**Decision:** Determine whether the fourteen Standard/high PDP videos are ready for a customer-facing release.

## Objective

Create a separate internal-review page that follows the proven visual structure of the REVOLVE 0911 page while presenting the newly generated Growth Studio PDP videos. The review page must make product fidelity and motion easy to judge without changing, overwriting, deploying over, or linking its release lifecycle to `revolve-pixverse-0911`.

## Release Isolation

- New local release directory: `deploy/brand-pitches/revolve/pdp-review/`.
- Proposed internal-review Cloudflare Pages project and canonical URL: `revolve-pdp-review` and `https://revolve-pdp-review.pages.dev/`.
- Reserve `https://revolve-pdp.pages.dev/` for a later approved customer-facing release.
- Do not modify `deploy/brand-pitches/revolve/v4/`.
- Do not deploy to or change the existing `revolve-pixverse-0911` project.
- Public deployment is a separate explicit approval step after local QA.

## Content Architecture

The page will preserve the 0911 proof-first ordering:

1. Compact REVOLVE × PixVerse header.
2. Clear internal-review label and review-specific headline.
3. Six featured product videos.
4. Eight additional product videos.
5. A concise review footer with no sales CTA.

The fourteen products remain in the campaign's established display order. Every card will show the brand, product name, stable color or variant, canonical REVOLVE product link, video player, and direct video link. The page will not expose model names, prompts, API job IDs, generation timestamps, prices, wallet data, local paths, or implementation commentary.

## Media Source and Presentation

- Use the fourteen Standard/high outputs recorded by the PDP campaign artifacts.
- Use the Standard/high result for `LIOR-WD140`, not its earlier Pro/high comparison.
- Generate fresh local poster frames from the new videos at a clean, centered product-readable moment.
- Preserve portrait media in stable `9:16` frames.
- Apply centered `object-fit: contain` in cards and fullscreen playback; never crop product-fidelity video to fill a card.
- Use `preload="metadata"` only for the first featured video and `preload="none"` for all others.
- Load one initial poster on mobile and three on desktop; defer the remaining posters with `IntersectionObserver`.
- Provide a useful fallback when a poster or video is unavailable.

## Visual Direction

The page will follow the restrained black-and-white REVOLVE presentation of the 0911 release while normalizing shared PixVerse controls and interaction states to the PixVerse design system:

- Pure black canvas and high-contrast white text.
- White-alpha borders and interactive fills rather than shadows.
- Plus Jakarta Sans for UI typography.
- Consistent radii, spacing, focus states, and 44-pixel minimum touch targets.
- One subtle `Internal Review` status treatment; no decorative gradients, AI motifs, metric wall, or nested cards.
- A compact hero that keeps real video proof visible near the first viewport.

## Internal Review and Privacy Treatment

- Page title: `REVOLVE × PixVerse | PDP Video Review`.
- Add `robots` metadata with `noindex, nofollow, noarchive`.
- Omit customer-specific Open Graph imagery and other share-preview promotion.
- Display a restrained `Internal Review` label in the page chrome.
- Do not add analytics, cookies, review forms, or persistent reviewer identity in this iteration.
- Assume direct media URLs can be forwarded; include only the authorized product media and outputs already selected for this review.

## Implementation Boundaries

The page will be a self-contained static release using HTML, CSS, JavaScript, and local approved brand/poster assets. It will not introduce a framework, build-time dependency, backend, authentication system, or billable API request. The PDP campaign manifest remains the source of truth for product order and output URLs; the review release receives a sanitized presentation-only data file or static markup derived from it.

## Accessibility and Responsive Behavior

- Semantic header, navigation, main, sections, articles, and footer.
- Logical heading order and a keyboard-visible skip link.
- Descriptive player labels and meaningful motion descriptions.
- Visible keyboard focus for links and native video controls.
- Responsive two-column featured layout on wide screens and one-column layout on narrow screens.
- No horizontal overflow at 320, 375, 768, 1280, and 1920 CSS pixels.
- Respect `prefers-reduced-motion`.
- Long product and brand names must wrap without colliding with controls.

## Verification

Implementation is complete only when all of the following pass:

1. The release contains exactly fourteen distinct product cards in campaign order.
2. Every player references the correct Standard/high video and every direct-video link matches its player.
3. All fourteen videos return successfully, support playback, and retain their verified `1440 × 2560`, 30 fps encoding.
4. Every poster exists locally and is visibly product-readable.
5. Inline and fullscreen video preserve centered `contain` behavior.
6. Desktop initially requests no more than three posters; mobile initially requests no more than one.
7. Remaining posters load shortly before their cards reach the viewport.
8. Keyboard, responsive layout, reduced motion, and fallback states work.
9. The final release directory contains no secrets, local filesystem paths, job IDs, wallet information, or private notes.
10. The original V4 directory and the deployed 0911 page remain byte-for-byte unchanged.
11. Local release tests pass before any deployment is proposed.

## Out of Scope

- Publishing or modifying the customer-facing `revolve-pdp.pages.dev` release.
- Changing or redeploying `revolve-pixverse-0911`.
- Accept/reject workflows, reviewer accounts, annotations, analytics, or persistence.
- Regenerating or editing any PDP video.
- Making customer claims or presenting a pilot proposal.

## Approval and Publication Boundary

The approved implementation produces a local internal-review artifact first. Creating the new Cloudflare Pages project or publishing the page requires a separate explicit approval after local visual, security, and responsive QA.
