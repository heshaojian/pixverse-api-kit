# PixVerse Platform API Capabilities Infographic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, preserve, download, and visually verify one PixVerse-branded 4:5 infographic that combines the Platform capability universe, production pipeline, and complete capability matrix.

**Architecture:** Use the web `pixverse` CLI for one text-to-image request after a read-only account/workspace preflight and explicit live-spend approval. Preserve the exact prompt and JSON response before downloading the generated image, then inspect the original-resolution output against the approved content and brand criteria without silently creating a second paid generation.

**Tech Stack:** PixVerse CLI, `gemini-3.1-flash`, JSON output, shell/JQ for read-only parsing, Codex image inspection.

**Spec:** `docs/superpowers/specs/2026-09-19-platform-api-capabilities-infographic-design.md`

## Global Constraints

- Use the web `pixverse` CLI, not `pixverse-api platform` or `pixverse-api growth-studio`, for the creative image generation.
- Generate exactly one 4:5 image with `gemini-3.1-flash` at `2160p` unless preflight shows that combination is unavailable.
- Treat generation as billable. Obtain explicit authorization immediately before the live `pixverse create image` command.
- Preserve the returned image ID and JSON before polling, downloading, or considering any refinement.
- Do not retry an ambiguous submission.
- Do not generate a second image merely because text is imperfect; report the first result and request fresh refinement authorization.
- Use the checked 30-operation catalog plus webhook integration as the content source.
- Do not embed volatile template counts, current credit balances, prices, or rate-limit numbers in the artwork.
- Use the canonical PixVerse dark visual system: black canvas, white-alpha hierarchy, Plus Jakarta Sans, Inconsolata numerics, and restrained create-gradient emphasis.
- Keep generated artifacts under `pixverse-api-jobs/platform-capabilities-infographic/`; do not add them to Git.

## File Structure

| File | Responsibility |
|---|---|
| `pixverse-api-jobs/platform-capabilities-infographic/prompt.txt` | Exact approved generation prompt. |
| `pixverse-api-jobs/platform-capabilities-infographic/preflight.json` | Redacted auth/workspace/account readiness summary with no token material. |
| `pixverse-api-jobs/platform-capabilities-infographic/generation.json` | Unmodified JSON success response containing the image ID and result URL. |
| `pixverse-api-jobs/platform-capabilities-infographic/final.png` | Downloaded original generated image. |
| `pixverse-api-jobs/platform-capabilities-infographic/qa.md` | Evidence-based visual QA and publication-readiness assessment. |

---

### Task 1: Preflight the PixVerse workspace and freeze the exact prompt

**Files:**
- Create: `pixverse-api-jobs/platform-capabilities-infographic/prompt.txt`
- Create: `pixverse-api-jobs/platform-capabilities-infographic/preflight.json`

**Interfaces:**
- Consumes: approved infographic spec, `pixverse auth status --json`, `pixverse workspace status --json`, and `pixverse account info --json`.
- Produces: an exact billable command proposal and a redacted readiness record that contains no OAuth token or session data.

- [ ] **Step 1: Verify the CLI and account with read-only commands**

Run:

```bash
pixverse --version
pixverse auth status --json
pixverse workspace status --json
pixverse account info --json
```

Expected: CLI version succeeds, authentication is active, a workspace is identified, and the account response exposes a usable credit balance. Do not print or save token files.

- [ ] **Step 2: Record a redacted preflight summary**

Create `preflight.json` with the actual returned CLI version, `authenticated: true`, the actual workspace ID normalized to a string, the actual workspace name, the reported credit value, and the current ISO-8601 timestamp. Keep the field names `cli_version`, `authenticated`, `workspace_id`, `workspace_name`, `credits_available`, and `checked_at`.

Expected: no access token, refresh token, cookie, API key, authorization header, email address, or private asset URL is present.

- [ ] **Step 3: Save the exact generation prompt**

Write this exact prompt to `prompt.txt`:

```text
Create a premium vertical 4:5 technical infographic for PixVerse titled “Build the complete AI video experience”. Pure black canvas, precise editorial grid, flat vector information design, white typography, translucent white glass panels with thin white-alpha borders, no shadows. Use Plus Jakarta Sans for labels and Inconsolata for numeric labels. Use the PixVerse create gradient from warm orange through magenta to violet only as a restrained top rule and around the central hero count.

Header: small eyebrow “PIXVERSE PLATFORM API · CAPABILITY MAP”; large headline “Build the complete AI video experience”; subtitle “From creative inputs to production-ready delivery through one integrated API platform.”

Upper section, capability universe: one large central circular core reading “30 SPECIALIZED OPERATIONS”. Arrange six balanced capability systems around it with subtle connector lines: “GENERATE — Text, Image, Templates, Transitions, Fusion”; “TRANSFORM — Restyle, Modify, Swap, Extend, Motion, Upscale”; “SPEECH & AVATARS — Lip Sync, Sound, TTS, Custom Voices, Avatar”; “AI AGENTS — Viral Recreation, Real Estate”; “RESOURCES — Uploads, Template Catalog, Speaker Catalog, Restyle Catalog”; “PLATFORM OPERATIONS — Balance, Usage, Status, Webhooks”.

Middle section, a clearly separated five-stage horizontal production pipeline with numbered steps and arrows: “01 DISCOVER — Templates, voices, styles”; “02 PREPARE — Upload image, video, audio”; “03 CREATE — Generate videos and images”; “04 TRANSFORM — Edit, extend, enhance”; “05 DELIVER — Track, webhook, measure”.

Lower section titled “Complete capability matrix”, arranged as six tidy cards: “VIDEO GENERATION — Text-to-video, Image-to-video, Template, Transition, Multi-transition, Fusion”; “VIDEO TRANSFORMATION — Restyle, Swap Mask, Swap, Extend, Motion Control, Modify, Upscale”; “SPEECH & AUDIO — Lip Sync, Sound Effects, Avatar, TTS Speakers, Create/Delete Custom Voice”; “IMAGES & RESOURCES — Image Template, Image Status, Upload Image, Upload Media, Templates, Restyle Effects”; “AI AGENTS — Viral Recreation, One-click Real Estate”; “PLATFORM OPERATIONS — Balance, Usage, Video Status, Webhooks”.

Footer: “UP TO 1080P · ASYNC JOBS · SECURE WEBHOOKS” and “docs.platform.pixverse.ai”. Make the three reading levels unmistakable: platform overview first, workflow second, detailed reference third. Keep typography crisp and spacious, all major labels readable, exact six-system and five-stage counts. No invented features, extra sections, mock code, robots, brains, neon circuitry, 3D icons, decorative sci-fi elements, gradients used as decoration, or unreadable microtext.
```

Expected: the file contains the three content layers, the exact central count, six systems, five pipeline stages, six matrix cards, and the no-invention/legibility constraints.

- [ ] **Step 4: Present the exact billable command and stop for approval**

Proposed command:

```bash
pixverse create image \
  --prompt "$(<pixverse-api-jobs/platform-capabilities-infographic/prompt.txt)" \
  --model gemini-3.1-flash \
  --quality 2160p \
  --aspect-ratio 4:5 \
  --count 1 \
  --json
```

Expected: do not execute this command until the user explicitly approves this exact single generation after seeing the preflight result.

---

### Task 2: Submit one image generation and preserve its identity

**Files:**
- Create: `pixverse-api-jobs/platform-capabilities-infographic/generation.json`

**Interfaces:**
- Consumes: approved `prompt.txt`, successful `preflight.json`, and explicit authorization for one paid image generation.
- Produces: one complete PixVerse JSON response with an image ID and result URL, or one preserved ambiguous/error response with no automatic retry.

- [ ] **Step 1: Execute the approved command exactly once**

Run the command shown in Task 1 Step 4 and save its stdout JSON directly as `generation.json`.

Expected: exit code `0`, `status` is completed, and the result contains `image_id` and `image_url`. If the command times out after submission or returns an ambiguous result, preserve the output/error and stop; do not run it again.

- [ ] **Step 2: Validate the generation response before download**

Run:

```bash
jq -e '(.image_id != null) and (.status == "completed") and (.image_url | type == "string" and startswith("https://"))' pixverse-api-jobs/platform-capabilities-infographic/generation.json
```

Expected: `true`. Record the image ID, model, credit-cost field when returned, and URL for the final handoff.

---

### Task 3: Download and visually verify the original result

**Files:**
- Create: `pixverse-api-jobs/platform-capabilities-infographic/final.png`
- Create: `pixverse-api-jobs/platform-capabilities-infographic/qa.md`

**Interfaces:**
- Consumes: completed `generation.json` and its preserved `image_id`.
- Produces: the local original image plus a QA report that distinguishes verified content, visual strengths, and text limitations.

- [ ] **Step 1: Download through the PixVerse asset command**

Run:

```bash
pixverse asset download "$(jq -r '.image_id' pixverse-api-jobs/platform-capabilities-infographic/generation.json)" \
  --output pixverse-api-jobs/platform-capabilities-infographic/final.png \
  --json
```

Expected: a non-empty PNG exists at the exact output path. If the installed CLI uses a different explicit output flag, check `pixverse asset download --help` and use the documented equivalent without changing the generation.

- [ ] **Step 2: Inspect the image at original resolution**

Use the local image-inspection tool on `final.png` with original detail. Verify:

- header hierarchy and major-label legibility;
- central `30 SPECIALIZED OPERATIONS` claim;
- exactly six capability systems;
- exactly five pipeline stages in order;
- six lower capability cards;
- absence of invented platform families;
- black/white-alpha PixVerse visual language with restrained create gradient;
- no clipping, duplicated panels, malformed connectors, or unintended extra copy.

Expected: every item receives a direct pass/fail observation rather than an assumed pass.

- [ ] **Step 3: Write the QA report**

Create `qa.md` with the title `Platform Capabilities Infographic QA`; record the actual image ID followed by model `gemini-3.1-flash`, quality `2160p`, and aspect ratio `4:5`. Add `Passed`, `Limitations`, and `Verdict` sections. Populate them only with direct observations from the original-resolution image. The verdict must be exactly one of `Presentation-ready`, `Useful draft`, or `Needs refinement`, followed by one evidence-based sentence.

Expected: no claim of presentation readiness when capability labels are misspelled or unreadable.

- [ ] **Step 4: Handoff without silently refining**

Show the local `final.png` inline and report the image ID, model, quality, aspect ratio, credit cost when returned, and QA verdict. If refinement is needed, preserve this result and request fresh authorization for exactly one additional generation.

Expected: the turn ends with the generated artifact or a precise blocker; no second paid call occurs.

---

## Final Verification

Run:

```bash
test -s pixverse-api-jobs/platform-capabilities-infographic/prompt.txt
jq -e '.authenticated == true' pixverse-api-jobs/platform-capabilities-infographic/preflight.json
jq -e '.image_id != null and .status == "completed"' pixverse-api-jobs/platform-capabilities-infographic/generation.json
test -s pixverse-api-jobs/platform-capabilities-infographic/final.png
test -s pixverse-api-jobs/platform-capabilities-infographic/qa.md
git status --short
```

Expected: every artifact check passes. Git status may show `pixverse-api-jobs/` and `.superpowers/` as untracked local artifacts; neither is committed.
