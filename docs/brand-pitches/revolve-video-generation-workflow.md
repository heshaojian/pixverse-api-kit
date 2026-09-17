# REVOLVE Video Generation Workflow

This document records the workflow used to produce the ten videos in the public [REVOLVE x PixVerse demo](https://revolve-pixverse-0911.pages.dev/?v=0911-final).

The final videos were generated as a controlled batch through the PixVerse CLI. Each product combined verified product information, official product photography, a camera storyboard, product-specific music, constrained video generation, and human quality review.

## Output Summary

| Setting | Final V4 value |
| --- | --- |
| Products | 10 |
| Product mix | 5 top-seller candidates and 5 newer arrivals |
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

The batch used ten products across dresses, tops, pants, and outerwear. The goal was to demonstrate creative range without making the customer review an oversized catalog exercise.

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

Each V4 job stores this provenance in its `source-request.json` file. For example, see the [LIONESS Stars Align Mini Dress source request](../../pixverse-cli-jobs/revolve-v4/01-lior-wd140-stars-align-mini-dress/source-request.json).

## 3. Create A Camera Storyboard

GPT Image 2.5 Flare generated a high-detail, 1440p vertical storyboard for each product. The storyboard was a precise four-panel camera plan rather than a finished fashion photograph:

1. Enter the frame
2. Pause for a readable front view
3. Turn naturally to reveal the side and back
4. Exit or finish in a three-quarter view

The storyboard prompts described the product construction and prohibited logos, captions, accessories, altered proportions, and invented details.

The approved storyboards from the earlier generation round were reused byte-for-byte for V4. This kept the camera plan constant while the final video model changed to MiniMax H3.

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

The selected cue was trimmed and mastered to match the target eight- or ten-second video duration. Final encoded duration can vary by a few frames.

## 5. Generate The MiniMax H3 Video

Each MiniMax H3 request combined:

- The approved four-panel storyboard as the camera plan
- Three or four authoritative product photographs
- The mastered product-specific soundtrack as `@audio1`
- A product-specific motion and fidelity prompt
- One controlled generation at 1440p and 9:16

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
- Natural movement and fabric behavior
- Correct front, side, and back appearance
- Stable full-body framing
- Closed mouth and no visible speaking
- No captions, invented logos, or extra garments
- Music appropriate to the fashion style

### Technical checks

- Correct duration, resolution, and frame rate
- H.264 video and stereo AAC audio present
- No silent-gap events
- Public media URL returns a playable video
- Product-to-video mapping is correct
- Release artifacts contain no credentials or private paths

All ten V4 outputs passed the release gate. The QA report records ten approved videos, zero held for review, and zero rejected.

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
