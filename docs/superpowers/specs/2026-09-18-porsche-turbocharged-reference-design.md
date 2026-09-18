# Porsche Turbocharged Patch Authority Reference

## Objective

Prevent the `PORSCHE TURBOCHARGED` sleeve patch from becoming blurred, misspelled, mirrored, or replaced with pseudo-text in future Porsche x REVOLVE jersey videos.

## Scope

- Add one dedicated high-resolution authority image for the `PORSCHE TURBOCHARGED` sleeve patch.
- Keep the chest `PORSCHE` wordmark workflow unchanged; it does not receive a dedicated reference.
- Preserve the existing storyboard, full-garment photographs, soundtrack, MiniMax H3 model, framing, and right-turn choreography.
- Update the Porsche request artifacts and the public `revolve-dev` handoff to document the new reference order.
- Do not open a paid generation job as part of this implementation.

## Authority Image

- Source only from the official REVOLVE product photograph `PCHR-WS7_V6.jpg`.
- Crop tightly around the complete rectangular sleeve patch, retaining its black outer border and a small amount of surrounding black sleeve fabric for placement context.
- Enlarge the crop deterministically to a 2048px-class PNG using high-quality resampling.
- Do not use generative fill, redraw lettering, replace colors, synthesize edges, or reconstruct the logo.
- Record the source filename, crop rectangle, dimensions, and SHA-256 hash in the Porsche request.

## Reference Order

1. Existing four-panel storyboard.
2. New high-resolution `PORSCHE TURBOCHARGED` patch authority image.
3. Existing official full-garment and detail photographs in their current order.
4. Existing music master as the audio reference.

The patch authority image controls exact lettering, border geometry, yellow/black/silver colors, and local texture. The official product photographs continue to control garment silhouette, color blocking, patch placement and scale, fabric, chest wordmark, neckline `959`, and the opposite sleeve patch.

## Prompt Contract

The accepted prompt must identify the authority image explicitly and require:

- Exact two-line text: `PORSCHE` above `TURBOCHARGED`.
- Unchanged character order, spelling, letterform proportions, spacing, border, and colors.
- No mirrored letters, pseudo-text, substitutions, extra marks, softened characters, or patch relocation.
- A stable three-quarter view long enough to inspect the patch without changing the approved motion sequence.

## Public Developer Handoff

The Porsche record on `revolve-dev` will expose:

- The dedicated patch authority image.
- Its role and official source provenance.
- The revised reference command with the patch image immediately after the storyboard.
- The revised prompt and sanitized request JSON.
- A reference-role list that distinguishes identity authority from ordinary product photographs.

## Validation

- Confirm the authority image is derived from `PCHR-WS7_V6.jpg` and contains no generated content.
- Confirm the patch is fully visible, readable, and not clipped.
- Confirm the public request includes one and only one dedicated logo authority image.
- Confirm the chest wordmark has no dedicated reference.
- Confirm commands use environment placeholders and expose no API key, private workspace ID, upload path, or local absolute path.
- Run the focused `revolve-dev` tests, the full repository test suite, syntax checks, and a public-bundle secret scan.

