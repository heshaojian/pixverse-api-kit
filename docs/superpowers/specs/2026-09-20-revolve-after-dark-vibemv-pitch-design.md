# REVOLVE “After Dark” VibeMV Pitch Design

**Date:** 2026-09-20

**Status:** Approved direction; implementation pending

**Customer context:** REVOLVE

**Primary reader:** Brand marketing lead

**Requested decision:** Approve a controlled three-product MV-style social pilot

**Primary CTA:** Select three products for a controlled pilot

## 1. Objective

Create one original, product-led music-video proof for REVOLVE using PixVerse VibeMV, then present it in a private, proof-first pitch page. The artifact should demonstrate how a recognizable REVOLVE product can become a music-led vertical social concept without asking the reader to understand models, prompts, or internal production mechanics.

The proof uses the LIONESS Stars Align Mini Dress in Onyx (`LIOR-WD140`) because the repository already contains controlled source imagery, a stable product record, prior approved motion work, and a canonical product link. Existing assets provide a clear fidelity baseline without introducing a new research or licensing surface.

## 2. Scope

### Included

- One original 20-second instrumental synth-pop track.
- One VibeMV generation using the approved product/model reference.
- One 9:16, 1080p hero deliverable when the live VibeMV schema and account entitlement allow it.
- Product, motion, audio, and technical QA of the returned result.
- One new private REVOLVE pitch-page route led by the approved MV.
- Responsive desktop and mobile presentation, accessibility checks, media fallbacks, and release tests.

### Excluded

- Public publication, search indexing, social-preview distribution, or customer outreach.
- Multiple MV variants, automatic retries, or replacement generations.
- Claims of an official REVOLVE partnership, endorsement, or confirmed business problem.
- A multi-product final campaign, even though the proposed next-step pilot covers three products.
- Technical explanations, model names, job IDs, prompt text, pricing, or internal workflow details on the customer-facing page.

## 3. Source Truth

### Product record

- **Product:** LIONESS Stars Align Mini Dress in Onyx
- **Stable identifier:** `LIOR-WD140`
- **Canonical URL:** `https://www.revolve.com/lioness-stars-align-mini-dress-in-onyx/dp/LIOR-WD140/`
- **Authoritative images:**
  - `assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V1.jpg`
  - `assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V2.jpg`
  - `assets/revolve-pilot-controlled-images/LIOR-WD140/LIOR-WD140_V3.jpg`
- **Required visible truth:** onyx-black satin; lace-trim halter neckline; fitted mini silhouette; low back; lace hem trim; hidden back zipper.
- **Forbidden changes:** added accessories, extra garments, alternate colors, changed hem or neckline, corrupted lace, invented logos or text, duplicated people, unstable anatomy, or product-obscuring framing.

The official product photographs override all creative treatment for garment color, texture, construction, and silhouette.

## 4. Creative Direction

### Concept

**After Dark** treats the dress as the visual anchor of a compact fashion-performance film. A single synthetic adult model moves through a restrained night-drive environment of reflective glass, wet pavement, and silver-blue light. The product remains readable while the camera and light follow the music’s pulse.

### Visual law

Every scene is seen directly or indirectly through a reflection. Reflections may shape framing and transitions, but must not duplicate the model or distort the garment.

### Motion grammar

- Open on a clean, product-readable full-body frame.
- Use measured forward camera movement on the main pulse.
- Alternate direct performance framing with reflective details.
- Include one controlled turn that reveals the side and low back.
- Finish on a stable hero silhouette suitable for the pitch-page poster.
- Avoid fast choreography, visible singing, lip-sync, presenter gestures, or random montage drift.

### Color and light

- Onyx black remains neutral, glossy satin rather than charcoal, brown, or crushed black.
- Lighting uses cool silver-blue highlights with restrained warm street reflections.
- Exposure must preserve lace, satin surface character, neckline, hem, and silhouette.
- The environment stays secondary and contains no readable third-party branding.

## 5. Music Design

Generate one 20-second instrumental cue using the current supported PixVerse music model and an explicit duration parameter.

The cue should be cinematic synth-pop at approximately 116–122 BPM with a complete 20-second arc: immediate hook, controlled lift, one clean transition point, and a resolved final beat. Use tight electronic drums, glassy synth pulses, a warm sub-bass foundation, and no vocals, voice samples, crowd noise, or copyrighted melodic references.

After generation:

- Verify the downloaded audio duration with `ffprobe`.
- Reject unexpected vocals, clipping, abrupt truncation, excessive loudness, or a duration outside normal encoding tolerance.
- Preserve the generated track as the exact source audio supplied to VibeMV.

## 6. VibeMV Contract

Use the live `vibe_mv` MiniApp schema rather than a stored parameter assumption. The intended configuration is:

- Audio: the approved generated 20-second instrumental.
- Character image: the strongest product/model source image selected from the three controlled references.
- Video style: cinematic fashion performance, using the closest live supported value.
- Music style: synth-pop/electronic, using the closest live supported value.
- Lip-sync: disabled.
- Subtitles: disabled.
- Aspect ratio: `9:16`.
- Quality: `1080p`.

Upload inputs first and use the returned media paths in the MiniApp request. Preserve the returned project ID and all task/result artifacts.

If the live schema, account entitlement, or quote cannot support this exact request, stop before submission. Do not silently substitute a different aspect ratio, quality, duration, workspace, or creative route.

## 7. Paid-Generation Boundary

- Target the `US team` workspace with a per-command override; do not change the persisted workspace default.
- Run read-only authentication, workspace, balance, slot, schema, and quote checks before submission.
- The authorized batch contains exactly two paid creations: one 20-second music task and one VibeMV task.
- The exact successful preflight quote becomes the maximum authorized cost for this batch.
- Submit each task once and preserve its ID before polling.
- Do not retry, regenerate, upgrade, extend, or create variants without a new user decision.
- If a provider response is ambiguous, reconcile the original task; never submit a replacement that could duplicate billing.

## 8. Pitch Page

### Story order

1. Compact REVOLVE × PixVerse header.
2. Customer-specific headline and the MV hero in the first viewport.
3. A concise statement of what the proof demonstrates.
4. A three-product controlled-pilot proposal.
5. Observable pilot criteria.
6. One CTA: “Select three products for a controlled pilot.”
7. Brief concept and relationship disclaimer.

### Copy direction

Working headline: **Make the next drop move to its own beat.**

Supporting copy should say that the concept translates one recognizable product into a music-led vertical social asset. It must not claim that REVOLVE has a creative-volume problem or that the concept represents an official partnership.

### Visual system

- The product footage is the signature element; surrounding design stays restrained.
- Use REVOLVE’s monochrome editorial restraint as the base language.
- Introduce cool silver-blue only for PixVerse action accents and timing marks derived from the track.
- Avoid gradient orbs, generic AI sparkles, nested cards, metric walls, and decorative badges.
- Use a precise editorial display face, a neutral highly legible body face, and a compact utility face for motion descriptions and pilot criteria. Use only licensed or safely hosted fonts.
- The page’s memorable device is a thin audio-progress line aligned with the hero video’s duration; it supports the MV thesis without behaving as decorative equalizer clutter.

### Media behavior

- Use the approved MV as the hero only after it passes QA.
- Select a clean, centered, mostly still poster frame that clearly shows the dress.
- Preserve the 9:16 source ratio with centered `object-fit: contain` inline and fullscreen.
- Use a neutral black media frame, familiar native controls, `playsinline`, descriptive labeling, and a direct-video fallback.
- Do not autoplay with sound.
- Keep all primary content usable with JavaScript disabled or media unavailable.

## 9. Pilot Proposal

The page proposes a seven-day, three-product pilot:

- REVOLVE selects three products and confirms source imagery.
- PixVerse applies one coherent music-led visual system across the set.
- Deliverables remain vertical and review-ready rather than publicly launched.
- Proposed success criteria are product-fidelity approval, three channel-usable outputs, review turnaround, and identification of at least one repeatable MV pattern.

All thresholds remain proposals until REVOLVE agrees to them.

## 10. Quality Gates

### MV approval

Score product fidelity, human motion, camera/framing, brand fit, technical quality, audio fit, and pitch usefulness from 1 to 5. The MV must average at least 4 and may not contain any critical failure.

Automatic rejection conditions:

- Wrong garment color, texture, neckline, hem, silhouette, back construction, or closure.
- Invented or corrupted text, branding, accessories, or garment features.
- Duplicated person, broken anatomy, face instability, or reflection artifacts.
- Unintended singing, visible lip-sync, subtitles, or voice.
- Missing or broken audio, duration mismatch, hard truncation, flicker, or unusable compression.
- Product-obscuring crop or no clean poster frame.

A rejected MV is not placed on the pitch page and is not regenerated without a new decision.

### Page approval

- Strongest proof appears in the first viewport.
- One reader, one decision, and one CTA remain obvious.
- All claims are verified, qualified, or removed.
- Desktop and mobile layouts preserve the full 9:16 frame.
- Keyboard, focus, contrast, alt text, labels, reduced motion, and 200% zoom pass.
- Media fallback, direct link, byte-range playback, and seeking work.
- No secrets, private paths, internal IDs, signed URLs, or unapproved analytics appear in the release.
- Final tests verify `noindex`, private-preview copy, poster loading, and absence of unapproved `object-fit: cover` rules.

## 11. Publication and Ownership

The deliverable stops at a local or access-controlled private preview. It uses `noindex`, generic/private-safe metadata, no customer-specific social preview, and no analytics unless separately approved. Public publication, customer sharing, or CRM/outreach activity requires a separate explicit decision.

The repository retains the source manifest, generation receipts, downloaded outputs, QA record, poster selection, page tests, and rollback-ready release folder. No API credentials or private account details enter tracked files.

## 12. Acceptance Criteria

The work is complete when:

1. The original 20-second instrumental is generated once, downloaded, and validated.
2. One VibeMV task is submitted once in the `US team` workspace and reconciled to a final result.
3. The MV passes every critical quality gate.
4. The private REVOLVE pitch page leads with the approved MV and follows the playbook’s proof-first order.
5. Focused tests and browser QA pass at mobile and desktop sizes.
6. The result remains local/private, with no public publication or external communication.
