# Brand Pitch Page Playbook

This playbook helps PixVerse teams build focused, customer-specific pitch pages that turn real product proof into a clear next decision. It applies across fashion, beauty, hardware, consumer packaged goods, accessories, and other product-led brands.

The central rule is simple:

> Show what PixVerse can do for this brand before explaining what PixVerse is.

A pitch page is not a general website, product tutorial, or AI trend report. It is a short decision experience for a specific customer.

## 1. Strategy

### Define one reader and one decision

Start by naming the primary reader: CMO, ecommerce leader, creative director, performance marketer, merchandising leader, or innovation team. Secondary readers matter, but they must not dilute the main story.

Write the desired decision in one sentence. Examples:

- Approve a one-week product-video pilot.
- Select three creative formats for a controlled test.
- Introduce PixVerse to the ecommerce and creative teams.

If the page asks for several unrelated decisions, narrow it.

### Establish the executive relevance filter

Every section must help the reader answer at least one of these questions:

1. What does the output look like for our products?
2. Why could this matter to our business or customers?
3. What is the smallest credible next step?

Remove content that does not pass this filter. AI education, model names, prompt details, internal workflows, and generic market statistics rarely earn space on a customer pitch page.

### Avoid invented pain points

Do not state that a customer has a particular problem unless evidence supports it. Replace assumptions such as "your CMO problem is creative velocity" with an observable opportunity:

- Weak: "Your team cannot make content fast enough."
- Stronger: "See ten current products translated into short-form motion."

The page should demonstrate relevance without pretending to know private priorities.

### Complete the pitch brief

Use this brief before research or generation:

```text
Customer:
Primary reader:
Decision requested:
Primary CTA:
Product category:
Products or assortment to feature:
Customer visual signals:
Approved customer assets:
Relevant channels:
Creative formats to demonstrate:
Target video duration:
Target audio duration: match video / approved edit handle
Product details that must remain exact:
Disallowed visual changes:
Pilot scope:
Customer-verifiable success criteria:
Publication mode: private preview / gated / public
Forwarding expectation: internal only / named recipients / safe to forward
Required approvals:
Search indexing: blocked / allowed
Analytics mode and retention:
Expiration or review date:
Review owner:
```

## 2. Research

### Build a customer evidence sheet

Research the customer's current product catalog, brand system, campaign language, channel mix, and public creative footprint. Prefer first-party product pages, official social accounts, investor materials, and brand guidelines.

Separate findings into three classes:

- **Verified fact:** Directly supported by a current source.
- **Reasonable hypothesis:** A possible opportunity to test, stated as such.
- **Creative direction:** A choice made for the pitch, not a customer fact.

Never promote a hypothesis into a headline as if the customer confirmed it.

### Maintain one product-truth record per demo

```text
Product name:
SKU or stable identifier:
Canonical product URL:
Source checked on:
Color or variant:
Visual color authority from official photos:
Texture authority from official photos:
Materials and construction:
Shape, geometry, or silhouette:
Logos, labels, controls, or packaging:
Front, side, and rear details:
Included accessories:
Usage constraints:
Details the video must not invent:
Reference image source:
```

Use stable product facts on the pitch page. Prices, availability, sales rank, reviews, and promotional language can become stale quickly; omit them unless they are dynamically maintained and material to the decision.

### Respect evidence and brand boundaries

- Do not imply that the page is an official partnership or endorsement unless approved.
- Do not publish confidential customer information or internal research notes.
- Confirm that logo and product imagery use is appropriate for the pitch context.
- Do not use proprietary fonts, photography, campaign files, or private brand-system assets without the required license or approval. When approval is absent, use public references to guide original design rather than copying protected assets.
- Record the source and review date for claims that remain on the page.
- Use a concise concept or pilot disclaimer when the relationship is not public.

## 3. Demo Curation

### Curate for range, not volume

A smaller, stronger collection beats a large repetitive gallery. Select products and outputs that show meaningful range across:

- Product categories or use cases
- Materials, colors, and silhouettes
- Camera distance and motion
- Creative format and channel fit
- Music or sound treatment
- Customer segments or merchandising moments

Lead with the strongest one to three demos. The first viewport should establish quality before the reader encounters rationale or pilot details.

### Make product truth the creative constraint

Motion should reveal the product, not compete with it. Preserve the details that drive customer trust:

- **Apparel:** silhouette, length, neckline, closures, trim, fabric behavior, and back construction.
- **Hardware:** geometry, proportions, ports, controls, screens, indicators, logos, and accessories.
- **Beauty and packaged goods:** package shape, label hierarchy, color, finish, cap or applicator, and product texture.
- **Accessories:** hardware, stitching, strap construction, scale, fastening, and material finish.

Use natural human motion where people appear. Avoid visual speaking when dialogue is not part of the concept. Do not invent props, accessories, packaging, product functions, or garment details.

### Establish color and texture authority

Official product photographs are the authority for color and texture. A catalog color name is merchandising metadata, not visual authority; names such as "Dark Taupe," "Pear," or "Soft White" must not cause the model to reinterpret the photographed appearance.

Apply this authority twice: first when creating the storyboard, then again when generating the final video.

**Storyboard generation**

- Supply the official product photos to the storyboard model.
- Describe the photographed color in plain visual terms, including warmth, brightness, undertone, and finish. Keep the catalog name only as identification.
- State explicitly that the official product photos override the catalog name for visible color and exposure.
- Match the source photography's lighting intent; forbid underexposure, crushed shadows, and named unwanted color shifts.
- For texture-sensitive products, prefer a texture-neutral storyboard made from outlines, silhouettes, framing boxes, and motion arrows. The storyboard should control camera behavior without inventing a competing fabric, finish, label, or surface.
- If a rendered garment is unavoidable, compare the storyboard against the official photos and reject it before video generation when its color or texture diverges.

**Final video generation**

- Put the official product photos first in the reference order and the camera storyboard last when the model accepts ordered references.
- State: "Official product photographs override the storyboard for product color, texture, material finish, construction, and branding. The storyboard controls camera and motion only."
- Repeat the photographed color description and prohibit the specific observed failure modes, such as dark-brown shift, charcoal shift, cool-gray cast, underexposure, excessive gloss, coarse loops, or flattened texture.
- Hold lighting and exposure consistent across front, side, and back views so a turn does not change the apparent product color.

**Release review**

- Compare representative front, side, back, collar, sleeve, and material-detail frames beside the official photos.
- Judge visible color and surface character, not whether the result matches the catalog color name.
- Reject materially darker, lighter, warmer, cooler, glossier, rougher, smoother, or structurally different output. Do not rely on color grading to repair a texture mismatch.

### Protect logos, labels, and readable text

Treat visible branding as exact product geometry, not as decorative texture. A model can preserve broad color blocking while replacing small letters with plausible-looking but incorrect characters.

For any product with a wordmark, patch, label, number, or other readable mark, use this reference order:

1. Place official front product views first so the main wordmark and overall product remain authoritative.
2. Place official logo and label close-up details next, including every sleeve, back, collar, package, or hardware area the motion may reveal.
3. Place side and rear product views after the branded detail references.
4. Place the storyboard last. It controls framing and motion only and must never override photographed lettering.

Transcribe expected text into the product-truth record, including capitalization, spacing, numbers, and placement. In the generation prompt, require exact preservation and prohibit substituted, mirrored, pseudo-letter, or newly invented characters.

Perform character-level QA on representative frames at 100% scale. Compare every visible wordmark, number, and patch against the corresponding official close-up. A missing, malformed, mirrored, or invented character is an automatic rejection even when motion, silhouette, and colors otherwise pass. When the model cannot preserve very small lettering reliably, change the shot so the detail is not presented as readable proof or use a controlled compositing workflow; never publish corrupted branding as a product-fidelity demo.

### Match generated media length to the deliverable

Treat duration as a billable production parameter, not merely a creative suggestion. For an eight-second video, request an eight-second music cue unless the approved edit explicitly needs additional handles.

For PixVerse CLI music generation, pass the target duration directly:

```bash
pixverse create music \
  --model music-3.0 \
  --instrumental \
  --duration-seconds "$TARGET_SECONDS" \
  --prompt "$PROMPT_FILE" \
  --output "$OUTPUT_FILE" \
  --json
```

`--duration-seconds` sets `duration_auto=false`. Prompt wording such as "the first eight seconds must feel complete" does not replace the duration parameter.

Apply these safeguards before a music request is submitted:

- Set `TARGET_SECONDS` from the approved final video duration.
- Keep automatic duration disabled for short-form deliverables.
- If the selected model cannot generate the exact length, use the shortest supported duration and disclose the difference before spending credits.
- Do not generate a full song and trim it as the default workflow.
- After download, verify the source duration with `ffprobe`; stop the pipeline if it exceeds the requested duration by more than normal encoding tolerance.
- Trim or master only for frame-accurate packaging, fades, loudness, or codec alignment, not to discard minutes of unused generated music.

### Give each demo a reason to exist

For each video, define:

- The product truth it proves
- The motion or camera behavior it demonstrates
- The intended channel or merchandising use
- The way it differs from the other selected demos

Do not publish near-duplicates merely to reach a round number.

### Score before publishing

Score each candidate from 1 to 5:

| Dimension | What to evaluate |
| --- | --- |
| Product fidelity | Shape, color, materials, logos, construction, and accessories remain accurate |
| Human motion | Movement, anatomy, expression, and interaction feel natural |
| Camera and framing | Product remains legible and important details stay visible |
| Brand fit | Setting, styling, pace, and music suit the customer's visual world |
| Technical quality | No warping, flicker, broken transitions, missing audio, duration mismatch, or compression failures |
| Pitch usefulness | The video adds evidence that supports the requested decision |

Reject a demo regardless of average score if it contains a critical failure: mutated branding or lettering, invented product features, materially wrong construction, severe anatomy problems, unintended visible speaking, unsafe claims, or unusable media.

## 4. Page Design

### Use a proof-first page blueprint

The recommended order is:

1. Compact co-branded header
2. Customer-specific headline and strongest demos
3. Remaining curated demos
4. Focused pilot proposal and measurable criteria
5. One primary CTA
6. Brief source or concept disclaimer

Do not place a long AI explanation, company overview, methodology section, or generic metric wall before the demos. Even when a reader needs context, establish concrete proof first and explain only what is necessary to evaluate the next step.

### Build a disciplined brand asset system

Use official, authorized assets. Do not recreate logos with text or approximate them using a similar font.

| Asset | Recommended use | Checks |
| --- | --- | --- |
| Customer wordmark | Primary customer identity in the header | Correct version, aspect ratio, contrast, and clear space |
| PixVerse mark or lockup | Technology partner identity in the header | Legible but secondary to the customer's context |
| Co-brand lockup | `Customer x PixVerse` in one stable header group | Balanced scale, aligned visual centers, mobile-safe spacing |
| Favicon | PixVerse product mark by default for a PixVerse-hosted pitch | SVG or crisp raster, recognizable at 16 to 32 pixels |
| Apple touch icon | Saved-page and mobile identity | Square 180-pixel asset with safe internal padding |
| Social preview | Shared-link presentation | Dedicated 1200 x 630 image using both brands and real demo imagery |
| Product imagery | Posters and product truth | Correct variant, useful crop, explicit dimensions, descriptive alt text |

Host approved logo assets with the page when practical so a third-party redesign or outage does not break the pitch. Never expose private asset-library URLs.

Treat every externally sourced SVG as active content. Pass it through an approved sanitizer or convert it to a trusted raster asset. Reject SVGs containing scripts, event-handler attributes, foreign objects, external resource references, embedded tracking, or unexpected links.

Use logos once, clearly. Repeating them in badges, backgrounds, and section headers weakens rather than strengthens the brand signal.

### Let the customer lead the visual language

Start from the customer's typography, density, color, photography, and interaction style. Add PixVerse identity through the lockup and restrained action accents. The result should feel prepared for the customer, not like the same template with a different logo.

Useful defaults:

- Restrained palette with high text contrast
- One primary action color or gradient
- Precise spacing and clear full-width sections
- Cards reserved for individual demos, not every piece of copy
- Corners and controls consistent with the selected visual system
- No decorative gradient orbs, generic AI sparkles, or stock-like imagery
- No cards nested inside cards
- No oversized hero that pushes all proof below the fold

### Write one strong headline

Use a literal, customer-specific outcome or offer. Keep descriptive value propositions in supporting copy.

- Weak: "The Future of AI Commerce"
- Stronger: "Make every new drop move at [Brand] speed."

Use sentence case unless the customer's identity requires otherwise. Do not turn output settings into the headline or badges. Labels such as "one-click," "silent," "no lip-sync," aspect ratio, and model name are implementation details unless the customer explicitly asked to evaluate them.

### Present demos as products, not technical artifacts

Each card should contain only information that helps evaluation:

- Brand and product name
- Stable variant or color when useful
- Video with familiar controls
- Short accessible motion description
- Canonical product link
- Direct video link when sharing the media separately is valuable

Avoid prompt text, model names, job IDs, internal status labels, or generation timestamps. Do not show prices by default.

### Treat desktop and mobile as separate compositions

Every inline video player, featured and non-featured, must preserve the source aspect ratio and maximize the media within its available frame. Apply the same fit policy in fullscreen or maximized playback. Consistency matters more than filling every pixel.

- Reserve every video frame with a stable aspect ratio before media loads, normally the source or approved deliverable ratio.
- Set the video to `width: 100%`, `height: 100%`, `object-fit: contain`, and `object-position: center`.
- Keep portrait videos at a readable maximum size on wide screens rather than stretching them to fill the viewport.
- Use a neutral or black frame background for unused space. Letterboxing is preferable to cropping the product.
- Never switch smaller or non-featured cards to `object-fit: cover` merely to fill the frame. Crop only through a separate, explicitly approved creative deliverable.
- Apply the centered `contain` rule to fullscreen playback at viewport width and height.
- Use responsive grid changes at deliberate breakpoints.
- Keep touch targets at least 44 pixels and prevent text or controls from overflowing.
- Ensure sticky navigation does not hide anchored sections.
- Verify the longest product and brand names, not only average examples.
- Respect reduced-motion preferences for page animation.

Use this baseline for product-fidelity video:

```css
.demo-media {
  aspect-ratio: 9 / 16;
  overflow: hidden;
  background: #000;
}

.demo-media video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.demo-media video:fullscreen,
.demo-media video:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  object-fit: contain;
  object-position: center;
  background: #000;
}
```

### Make icons functional

Use one familiar icon family for commands such as play, pause, external link, share, and navigation. Prefer the symbol alone when its meaning is conventional; add a short label or tooltip when it is not. Avoid decorative icons that imply unsupported AI capabilities.

### Design the share experience

A pitch is often first seen as a link preview. Include:

- Descriptive page title and meta description
- Open Graph title, description, URL, image, image dimensions, and image alt text
- Twitter/X large-image card metadata, including image alt text
- Favicon and Apple touch icon
- Canonical production URL

The social image should be designed, not a browser screenshot. Use real demos, readable co-branding, and a concise message that survives small previews.

Only public releases should carry customer-specific social previews by default. Link-preview crawlers cache images and text, sometimes beyond the page's lifetime. For private or pre-approval pitches, disable or generalize preview metadata, block search indexing, and assume any direct media URL can be forwarded. Never place signed, private, or access-bearing media URLs in shareable markup; publish separate public-safe copies only after approval.

## 5. Quality Assurance

### Protect speed without hiding proof

Scale loading behavior to the collection and viewport. For a typical small gallery, use these defaults:

- Give the first video a real poster fallback in HTML.
- Choose every poster frame deliberately from the first clean product-readability moment, not automatically from `0:00`. The product should be centered, mostly visible, and still or near-still enough to read material, color, silhouette, logos, text, and key construction. Avoid walk-in and walk-out frames, motion blur, awkward crops, empty background, and transitional poses.
- Load only the visible first set of posters: commonly one on mobile and up to three on desktop.
- Assign remaining posters shortly before their cards enter the viewport.
- Use `preload="metadata"` only for the flagship video and `preload="none"` for the rest.
- Never autoplay ten videos or preload every media file.
- Keep poster dimensions explicit to prevent layout movement.
- If `IntersectionObserver` is unavailable, assign the remaining local, public-safe posters immediately so the gallery remains usable.

For larger collections, paginate, group, or reveal additional demos on demand instead of extending the same eager-loading count. Recalculate the first-set size when card dimensions or grid columns change. Hardware or landscape media may use different aspect ratios, but the same visible-first rule applies.

Measure requests in a real browser at mobile and desktop widths. An image carrying `loading="lazy"` or a video using `preload="none"` is not proof that the intended network behavior occurred.

### Make the page resilient

- Provide descriptive labels and poster fallbacks when JavaScript or media fails.
- Confirm remote video hosts support byte-range requests and playback seeking.
- Show a useful unavailable state instead of a broken black rectangle.
- Keep core navigation and product links usable without animation.
- Avoid dependencies that can take the entire page down for a minor visual effect.

### Meet the accessibility baseline

- Use semantic headings and landmarks in reading order.
- Give logos and meaningful images accurate alt text; keep decorative images silent.
- Label every video for assistive technology and describe meaningful motion.
- Preserve keyboard access, visible focus, sufficient contrast, and touch-friendly controls.
- Do not rely on color alone to communicate status.
- Test zoom, long text, reduced motion, and narrow screens.

### Protect security and confidentiality

- Never put API keys, tokens, generation credentials, private folders, or customer data in page source.
- Never make billable generation requests directly from the public browser page.
- Remove local filesystem paths, internal job IDs, debugging output, and private research notes.
- Use secure links and `rel="noreferrer"` for new external tabs when referrer data is unnecessary.
- Review analytics and embedded services for customer privacy implications.
- Scan the final release folder, not only the main HTML file.

### Run the executive-readiness review

Read the page as a skeptical customer executive:

- Is the strongest proof visible immediately?
- Does the page feel made for this customer?
- Is every claim verified or clearly framed as a proposal?
- Does any content explain AI instead of advancing the decision?
- Are technical settings presented as if they were customer value?
- Does the pilot feel small enough to approve and meaningful enough to learn from?
- Is there one obvious next action?

## 6. Publish And Measure

### Use release stages

1. **Local:** Validate content, media, responsive layout, and accessibility.
2. **Preview:** Share a temporary or access-controlled URL with internal reviewers.
3. **Approved:** Freeze the exact customer-ready artifact and approval record.
4. **Production:** Publish to the canonical customer-specific URL.

Keep general PixVerse pages separate from customer pitch sites. Use clear project names and domains so a customer deployment cannot replace a product or corporate page accidentally.

### Choose the publication mode deliberately

Default customer-specific pitches to private preview or access-controlled delivery. A public release requires an internal brand/legal review and any customer approval required by contract, asset license, or relationship status. Before moving to public, confirm:

- Logos, product media, claims, testimonials, and relationship language are approved for public use.
- The page is safe to forward and does not depend on secrecy for context.
- Search indexing is intentionally allowed; otherwise use `noindex` and an appropriate robots policy.
- Social metadata contains only public-safe copy and assets.
- Direct media URLs contain no access tokens and may be treated as permanently shareable.
- An expiration or review date, takedown owner, and removal path are recorded.

Access control reduces accidental exposure but does not make forwarded screenshots, downloaded media, cached previews, or shared credentials disappear. Design the content for the actual forwarding risk.

### Verify production, not merely upload

After deployment:

- Load the canonical URL with a fresh cache.
- Confirm the expected headline and version are live.
- Check every product link, video link, logo, favicon, poster, and social image.
- Repeat mobile and desktop network and layout checks.
- Confirm there are no browser errors or horizontal overflow.
- Test the shared-link preview on relevant messaging or social platforms.
- Retain the deployment identifier and a rollback path.

An upload receipt is not the same as a verified production release.

### Measure signals that support the next decision

Useful events may include:

- Demo play and meaningful completion
- Product-link click
- Direct-video click
- Pilot CTA click
- Qualified customer response

Use privacy-conscious analytics and collect only what is needed. Do not encode customer identity, recipient identity, campaign secrets, or access credentials in URL parameters. Minimize or truncate IP addresses and user-agent data where the analytics service permits it. Define cookie or consent behavior, retention, access control, and deletion ownership before launch. Record a qualified response in an approved CRM or sales system rather than inferring personal identity from page telemetry. Do not put internal engagement dashboards or vanity metrics on the pitch page.

### Define pilot success with the customer

Good criteria are narrow, observable, and tied to the next investment decision. Examples include:

- Product-fidelity approval rate
- Time from approved source to review-ready output
- Number of outputs accepted for a channel test
- Number of repeatable creative patterns identified

Treat sample thresholds as proposals until the customer agrees to them.

### Assign maintenance ownership

Record who owns:

- Product and claim freshness
- Expired media or broken links
- Brand approval changes
- Analytics access and retention
- Domain and deployment maintenance
- Archiving or removing the page after the pitch lifecycle ends

## Pre-Publish Checklist

### Strategy and copy

- [ ] One primary reader and one requested decision are named.
- [ ] Demos appear before education or methodology.
- [ ] The headline is specific to the customer without claiming private knowledge.
- [ ] Every claim is sourced, qualified, or removed.
- [ ] Prices and other volatile facts are omitted unless maintained.
- [ ] One primary CTA leads to an owned next step.

### Brand and design

- [ ] Official customer and PixVerse assets are used.
- [ ] Fonts, photography, logos, and campaign assets are licensed or approved for this publication mode.
- [ ] Externally sourced SVG files are sanitized or converted to trusted raster assets.
- [ ] The co-brand lockup is balanced on desktop and mobile.
- [ ] Favicon, Apple touch icon, and 1200 x 630 social image are present.
- [ ] Logos retain aspect ratio, contrast, clear space, and correct variants.
- [ ] Product imagery shows the correct item and variant.
- [ ] No decorative clutter, redundant badges, or nested card layouts remain.

### Demos

- [ ] The strongest one to three outputs lead the page.
- [ ] Every demo adds meaningful creative or product range.
- [ ] Product fidelity and human motion pass review.
- [ ] Music or sound is intentional and matches the creative brief.
- [ ] No output contains invented product details or unintended visible speaking.
- [ ] Product and direct-video links resolve correctly.

### Responsive and accessible behavior

- [ ] Featured and non-featured video players use the same centered `contain` fit rule.
- [ ] Full products remain visible in both inline and fullscreen playback on desktop and mobile.
- [ ] At least one featured and one non-featured video are checked in both inline and fullscreen states.
- [ ] The release contains no unapproved `object-fit: cover` rule for product-fidelity video.
- [ ] Text and controls fit at narrow, standard, and wide viewports.
- [ ] No horizontal overflow, hidden anchors, or unstable card resizing occurs.
- [ ] Keyboard, focus, contrast, alt text, labels, and reduced motion are verified.
- [ ] Poster frames come from clean product-readability moments, not default `0:00`, half-entry, or exit frames.
- [ ] Poster and media-failure fallbacks remain useful.

### Performance, security, and release

- [ ] Initial poster requests match the intended mobile and desktop budgets.
- [ ] Deferred posters load before users reach them.
- [ ] Non-featured videos do not preload media.
- [ ] The release contains no secrets, private data, local paths, or internal identifiers.
- [ ] Publication mode, forwarding expectations, indexing, expiration, and takedown ownership are approved.
- [ ] Analytics collection, consent, retention, and access are documented.
- [ ] Social metadata and the canonical URL reference production assets.
- [ ] The canonical production page is checked after deployment.
- [ ] A rollback option and maintenance owner are recorded.

## Lessons From The REVOLVE Pitch

The REVOLVE page became stronger as it moved closer to proof and further from explanation. The most reusable lessons were:

1. **Demo first.** Executives did not need a lesson on AI before seeing the products move.
2. **Do not invent the executive problem.** A confident but unsupported claim about the CMO's priorities weakened credibility.
3. **Customer value outranks generation mechanics.** Labels such as "silent," "no lip-sync," "one-click," aspect ratio, and model name drew attention away from the work.
4. **Redundant badges add little.** Pills describing obvious properties used space without helping evaluation.
5. **Official logos matter.** A real REVOLVE wordmark, a real PixVerse mark, and a balanced co-brand lockup made the page feel intentional.
6. **The browser tab and shared link are part of the design.** Favicon and social-preview treatment affect the first impression before the page opens.
7. **Prices become liabilities.** Product colors remained useful; volatile prices were removed.
8. **Portrait media needs bounded, consistent sizing.** Use stable portrait frames and centered `contain` for every demo, including non-featured cards and fullscreen playback. Do not crop the product merely to fill a smaller card.
9. **Lazy loading must be measured.** The final behavior loaded one initial poster on mobile, three on desktop, and the rest near the viewport.
10. **Poster frames are proof, not decoration.** The poster should be selected from the first clean product-readability moment, not automatically from `0:00`, so the card opens with centered product evidence instead of a half-entry crop or empty background.
11. **A small measurable pilot is a better close than more persuasion.** The final page moved from proof directly to a focused next step.

## Final Rule

Before publishing, remove anything that asks the customer to understand PixVerse before PixVerse has demonstrated understanding of the customer.
