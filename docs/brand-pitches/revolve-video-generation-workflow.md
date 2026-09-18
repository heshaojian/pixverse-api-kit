# REVOLVE Video Generation Workflow

This document records the workflow used to produce the fourteen videos in the public [REVOLVE x PixVerse demo](https://revolve-pixverse-0911.pages.dev/?v=0911-final).

The final videos were generated as a controlled batch through the PixVerse CLI. Each product combined verified product information, official product photography, a camera storyboard, product-specific music, constrained video generation, and human quality review.

## Output Summary

| Setting | Final V4 value |
| --- | --- |
| Products | 14 |
| Product mix | Original 10-product assortment, 3 customer-requested material and branding tests, and 1 additional product |
| Storyboard model | GPT Image 2.5 Flare |
| Video model | MiniMax H3 |
| Music model | MiniMax Music 3.0 |
| Duration target | 8 or 10 seconds by product |
| Aspect ratio | 9:16 |
| Resolution | 1440 x 2560 |
| Frame rate | 24 fps |
| Final audio | Stereo AAC with one unique instrumental cue per product |

The tracked [batch configuration](../../pixverse-cli-jobs/revolve-v4/batch-config.json) contains the product order and generation settings. The [QA report](../../pixverse-cli-jobs/revolve-v4/qa-report.json) records the release decision for every output.

## 1. Select A Focused Product Set

The batch used fourteen products across dresses, tops, pants, and outerwear. The original ten-product assortment established category range; three customer-requested additions tested satin sheen, dense knit texture, and branded jersey lettering; one additional product completed the expanded gallery.

Each product received a stable identifier, canonical REVOLVE URL, product category, and display order. Generation order and customer-facing display order were recorded separately so the strongest examples could lead the pitch.

## 2. Build A Product-Truth Package

For each product, we collected:

- Canonical REVOLVE product URL
- Product name and color
- Material and construction details
- Three or four official product images
- Front, side, and rear views where available
- Details that the generated video must preserve

Important details included neckline, closures, trim, silhouette, garment length, fabric finish, back construction, and included accessories.

The official product photographs were the authoritative visual references. The video prompt explicitly instructed the model to follow those photographs if another reference conflicted with them.

For products with readable branding, the truth package must also transcribe every visible wordmark, number, and patch and retain an official branding close-up detail for each area the motion can reveal. The Porsche jersey requires exact preservation of the `PORSCHE` chest wordmark, `959` collar number, and sleeve patches rather than a generic approximation of their shapes.

Each V4 job stores this provenance in its `source-request.json` file. For example, see the [LIONESS Stars Align Mini Dress source request](../../pixverse-cli-jobs/revolve-v4/01-lior-wd140-stars-align-mini-dress/source-request.json).

## 3. Create A Camera Storyboard

GPT Image 2.5 Flare generated a high-detail, 1440p vertical storyboard for each product. The storyboard was a precise four-panel camera plan rather than a finished fashion photograph:

1. Enter the frame
2. Pause for a readable front view
3. Turn naturally to reveal the side and back
4. Exit or finish in a three-quarter view

The storyboard prompts described the product construction and prohibited logos, captions, accessories, altered proportions, and invented details.

The approved storyboards from the earlier generation round were reused byte-for-byte for V4. This kept the camera plan constant while the final video model changed to MiniMax H3.

### Color and texture authority correction

The Camila Coelho jacket correction showed that a storyboard can become an unintended competing product reference. A darker rendered storyboard pulled the final video away from the lighter warm taupe visible in the listing, and a later rendered storyboard introduced a coarser surface than the source garment.

The corrected rule is: official product photographs are the authority for color and texture. A catalog color name is identification, not visual authority. For example, "Dark Taupe" must not be interpreted as darker than the garment shown in the source photography.

For future storyboard requests:

- Supply the official product photos and state that they override the catalog name for visible color, exposure, and surface character.
- Describe the photographed brightness, warmth, undertone, and material finish directly.
- Use a texture-neutral storyboard for texture-sensitive products. It should express framing and motion with outlines, silhouettes, and arrows instead of rendering a new fabric surface.
- Reject the storyboard before video generation if it introduces underexposure, a color cast, a different sheen, or a coarser or smoother texture.

## 4. Generate Product-Specific Music

MiniMax Music 3.0 generated a unique instrumental cue for each product. The music direction reflected the garment's material and fashion character rather than applying one generic soundtrack to the whole batch.

Examples included:

- Sleek nocturnal electro-pop for black satin
- Airy French house for sculptural white poplin
- Minimal electro for fitted black capri pants
- Warm indie-electronic for chiffon
- Indie dance for vintage denim
- Minimal techno for architectural and studded dresses
- Dark trip-hop for a fluid black maxi dress

Every music request required:

- An immediate pulse from the first beat
- No opening silence
- No vocals, spoken words, or choir
- No dramatic impacts or unrelated sound effects

The original workflow left automatic music duration enabled. Although the final files were trimmed to the required video length, that produced unnecessarily long source tracks. This was a process mistake, not a creative requirement.

The corrected workflow requests the delivery duration directly:

```bash
pixverse create music \
  --model music-3.0 \
  --instrumental \
  --duration-seconds "$TARGET_SECONDS" \
  --prompt "$PROMPT_FILE" \
  --output "$OUTPUT_FILE" \
  --json
```

`--duration-seconds` sets `duration_auto=false`. Prompt wording about a complete opening does not replace the duration parameter. `TARGET_SECONDS` must equal the approved video duration, which is eight or ten seconds in this batch.

After generation, inspect the source with `ffprobe` and fail the job if it is materially longer than requested. Mastering may add a short fade or correct loudness, but it must not be used routinely to discard a multi-minute source track. If exact duration is unsupported, select the shortest supported option and surface that constraint before generation.

## 5. Generate The MiniMax H3 Video

Each MiniMax H3 request combined:

- The approved four-panel storyboard as the camera plan
- Three or four authoritative product photographs
- The mastered product-specific soundtrack as `@audio1`
- A product-specific motion and fidelity prompt
- One controlled generation at 1440p and 9:16

For color- or texture-sensitive products, reference order and prompt authority are explicit:

1. Place the official product photographs first.
2. Place the texture-neutral storyboard last.
3. State that official product photographs override the storyboard for product color and texture; the storyboard controls camera and motion only.
4. Repeat the photographed color description instead of relying on the catalog color name.
5. Ban the concrete failure modes seen in review, including underexposure, dark-brown or charcoal shifts, cool-gray casts, coarse loops, fleece-like texture, or flattened surface detail.

For logo- or text-sensitive products, use a stricter ordered set:

1. Place official front product views first.
2. Place official logo and branding close-up details next, covering each visible wordmark, number, label, and patch.
3. Place remaining side and rear product views after the branded details.
4. Place the storyboard last and state that it controls framing and motion only.
5. Require exact characters, capitalization, spacing, orientation, and placement; prohibit pseudo-lettering, mirrored text, substitutions, and invented marks.

The motion direction favored a restrained ecommerce presentation:

- Walk into the frame naturally
- Pause so the product remains readable
- Make one slow, relaxed turn
- Reveal the side and back construction
- Exit naturally
- Keep the camera stable and full-body
- Use a clean white studio and soft premium lighting
- Let movement meet the music without becoming dance-like

The negative constraints prohibited:

- Speaking, singing, lip-sync, or visible mouth movement
- Presenter gestures
- Captions, text, or unintended logos
- Additional accessories or garments
- Duplicate people
- Morphing or product changes
- Abrupt cuts
- Invented construction details

The tracked job records preserve the submitted model, quality, aspect ratio, duration target, reference counts, and prompt. Raw submission records also contain operational metadata, so customer-facing summaries should use sanitized extracts rather than linking those files directly.

## 6. Finish And Publish The Media

The generated video stream was retained while the mastered soundtrack was placed into the final delivery file. Final media used:

- H.264 video
- 1440 x 2560 resolution
- 24 fps
- Stereo AAC audio
- Continuous music with no silent gaps

Each approved video was uploaded to a stable PixVerse media URL. The upload response was stored alongside the source request, submission, and generation result, giving every product a complete artifact trail.

## 7. Review Every Output

We generated motion contact sheets and performed both visual and technical QA.

### Visual checks

- Product details preserved
- Front, side, back, collar, sleeve, and material-detail frames compared directly with the official product photos
- Visible product color matches the photos rather than merely matching the catalog color name
- Fabric or surface texture matches its photographed scale, density, finish, and structure
- Natural movement and fabric behavior
- Correct front, side, and back appearance
- Stable full-body framing
- Closed mouth and no visible speaking
- No captions, invented logos, or extra garments
- Music appropriate to the fashion style

Official product photographs override the storyboard during release review. A video fails even when its silhouette and motion are good if its color is materially shifted or its texture belongs to a different material class. Color grading may correct a small exposure offset, but it cannot repair invented texture.

For branded products, inspect every readable mark frame by frame at 100% scale and compare it with the matching official close-up. This is character-level QA: malformed, missing, mirrored, substituted, or invented characters are an automatic rejection. The Porsche jersey review exposed this gap after publication: the broad color blocking and chest treatment looked plausible, but a sleeve patch contained corrupted lettering. Future branded-product reviews must not pass on silhouette and color alone.

### Poster frame selection

For each approved video, choose the poster frame deliberately from the first clean product-readability moment, not automatically from `0:00`. Extract early frame candidates, then pick a centered, mostly visible, near-still product frame where material, color, silhouette, logos, text, and key construction can be read. Reject walk-in and walk-out frames, motion blur, awkward crops, empty background, and transitional poses. Check the chosen poster in both the local page and the public URL because the poster is often the customer's first view of the demo before playback starts.

### Technical checks

- Correct duration, resolution, and frame rate
- H.264 video and stereo AAC audio present
- No silent-gap events
- Public media URL returns a playable video
- Product-to-video mapping is correct
- Release artifacts contain no credentials or private paths

The initial release report recorded thirteen approved outputs. A later close review found corrupted sleeve-patch lettering on the Porsche jersey, so that approval was a false pass under the improved brand-text gate. Reference-first retries either corrupted the small patch or reduced the visible brand proof too aggressively. The accepted eight-second replacement uses the official front product photograph and official right-facing photograph as hard transition endpoints. This produces the same natural right-turn grammar as the other demos while preserving the `PORSCHE` chest wordmark, collar `959`, official sleeve patch, color blocking, and material appearance. The lesson is that exact branded motion is stronger when the desired start and finish are both official product photographs; reference ordering alone does not guarantee small lettering. Rejected intermediate generations remain in the local audit trail and are excluded from the customer page and release report.

## Why The Workflow Worked

The result was not driven by a generic text-to-video prompt. Product truth remained authoritative at every stage:

```text
REVOLVE product page and photos
  -> verified product-truth package
  -> GPT Image 2.5 camera storyboard
  -> unique MiniMax Music 3.0 soundtrack
  -> MiniMax H3 video generation
  -> audio mastering and final packaging
  -> visual and technical QA
  -> stable PixVerse media URL
  -> customer pitch page
```

The most important ingredients were multiple official references, a fixed camera plan, explicit product-detail constraints, restrained natural motion, music designed for each SKU, and a human release review.

## Reusable Rule

For future brand pitches, treat the product page and official product photographs as the source of truth. Use the storyboard to control camera behavior, the prompt to protect product details, and QA to decide whether an output is customer-ready.
