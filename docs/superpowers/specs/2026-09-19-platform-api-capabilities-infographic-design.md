# PixVerse Platform API Capabilities Infographic Design

**Date:** 2026-09-19

**Status:** Approved visual direction

## Objective

Generate one polished PixVerse-branded infographic that communicates the complete PixVerse Platform API surface at three reading depths: the platform-level story, the end-to-end production workflow, and the detailed capability matrix.

The image is an overview artifact, not API documentation. It must be accurate enough to orient developers and partners while remaining readable as a single vertical poster.

## Deliverable

- One static infographic generated with the web `pixverse` CLI image command.
- Aspect ratio: `4:5`.
- Preferred model: `gemini-3.1-flash` at `2160p`.
- Output directory: `pixverse-api-jobs/platform-capabilities-infographic/`.
- Preserve the PixVerse generation ID, JSON response, remote URL, and downloaded final image.

No Platform API generation endpoint is used for this artwork. The web `pixverse` CLI is the requested creative-generation tool; the Platform API capability catalog is the content source.

## Content Architecture

### Header

- Eyebrow: `PIXVERSE PLATFORM API · CAPABILITY MAP`
- Headline: `Build the complete AI video experience`
- Supporting line: `From creative inputs to production-ready delivery through one integrated API platform.`

### Layer 1: Capability universe

The upper section centers a prominent `30 SPECIALIZED OPERATIONS` core. Six surrounding systems establish the breadth of the platform:

1. Generate — text, image, templates, transitions, fusion.
2. Transform — restyle, modify, swap, extend, motion, upscale.
3. Speech and avatars — lip sync, sound, TTS, custom voices, avatar.
4. AI agents — viral recreation and real estate.
5. Resources — uploads, template catalog, speaker catalog, restyle catalog.
6. Platform operations — balance, usage, status, and webhooks.

The section should read as an integrated platform, not a collection of unrelated endpoint logos.

### Layer 2: Production pipeline

A five-stage horizontal process explains how the capability systems combine:

1. `DISCOVER` — templates, voices, styles.
2. `PREPARE` — upload image, video, audio.
3. `CREATE` — generate videos and images.
4. `TRANSFORM` — edit, extend, enhance.
5. `DELIVER` — track, receive webhooks, measure usage.

The flow must remain visually distinct from the capability universe and matrix.

### Layer 3: Capability matrix

The lower section contains six compact cards:

- Video Generation: text-to-video, image-to-video, template, transition, multi-transition, fusion.
- Video Transformation: restyle, swap mask, swap, extend, motion control, modify, upscale.
- Speech and Audio: lip sync, sound effects, avatar, TTS speakers, create/delete custom voice.
- Images and Resources: image template, image status, upload image, upload media, templates, restyle effects.
- AI Agents: viral recreation and one-click real estate.
- Platform Operations: balance, usage, video status, and webhooks.

The matrix lists conceptual capability names rather than URL paths or request fields. It must not imply that webhooks are one of the 30 specialized catalog operations; the headline count applies only to the checked CLI operation catalog.

### Footer

- `UP TO 1080P · ASYNC JOBS · SECURE WEBHOOKS`
- `docs.platform.pixverse.ai`

## Visual Direction

Use the PixVerse design system as the visual source of truth:

- Pure black canvas.
- Depth from translucent white panels and thin white-alpha borders, not shadows.
- White text hierarchy at full, 60%, and 40% opacity.
- Plus Jakarta Sans for UI copy and Inconsolata for the operation count and compact numeric labels.
- PixVerse create gradient only as the hero emphasis around the central capability count and a restrained header rule.
- Compact 8–16 px radius family, aligned to a 4 px grid.
- No generic neon circuitry, glowing brains, robots, sci-fi dashboards, stock icons, or decorative 3D elements.

The artifact should feel like a premium technical product poster created by PixVerse, not a generic AI-generated infographic.

## Generation Prompt Strategy

The generation prompt will specify:

- exact poster hierarchy and copy;
- black PixVerse canvas, white-alpha glass surfaces, exact brand gradient semantics;
- crisp editorial information design with a strong grid;
- flat vector-like diagram elements and restrained connector lines;
- high typographic legibility and generous breathing room;
- no extra labels, invented capabilities, mock code, or unreadable microtext;
- exact six-system and five-stage structures.

Because image models can misspell dense text, the first result is a visual draft subject to character-level QA. If the hierarchy is strong but text fidelity is insufficient, one refinement generation may be made only after preserving the first generation ID and confirming the first request completed. A second billable generation requires fresh user authorization unless the user has authorized the refinement in the active request.

## Credit and Execution Boundary

Image generation consumes web PixVerse credits. Before submission:

1. Confirm PixVerse CLI authentication and active workspace.
2. Inspect available credits.
3. Show the exact image command and identify it as one billable generation.
4. Obtain explicit authorization immediately before running that command.

Submit once. Preserve the returned image ID before polling or downloading. Do not retry an ambiguous submission.

## Quality Assurance

The generated image must be inspected at original resolution for:

- clear three-layer hierarchy;
- accurate `30 SPECIALIZED OPERATIONS` claim;
- exactly six capability systems and five pipeline stages;
- no invented endpoint families;
- readable headline and major labels;
- acceptable spelling of capability names;
- correct PixVerse dark visual language;
- no clipped panels, malformed icons, duplicated text, or accidental extra sections;
- suitable legibility at desktop presentation size and when scaled down.

If dense matrix microcopy is imperfect but the visual is otherwise useful, report the limitation rather than claiming publication readiness.

## Acceptance Criteria

- One combined infographic incorporates the capability universe, pipeline, and matrix.
- The design uses the canonical PixVerse visual system.
- Content traces to the checked 30-operation Platform catalog plus webhook integration.
- No volatile template counts, prices, credit balances, or rate-limit numbers are embedded.
- Generation is submitted once only after explicit live-spend approval.
- The final response includes the local image, generation ID, model, quality, aspect ratio, and an honest QA result.
