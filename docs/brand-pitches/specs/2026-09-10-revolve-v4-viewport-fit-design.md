# REVOLVE V4 Desktop Video Fit

## Purpose

Make the three featured 9:16 videos on the local REVOLVE V4 pitch page fully visible within a desktop viewport. Preserve the existing pitch-page hierarchy, content, media, and mobile layout.

## Current Problem

The featured grid divides the full content width into three equal columns. On a wide desktop, each portrait card becomes wide enough that its 9:16 media area is taller than the available screen. Reviewers must scroll to see the complete garment and native video controls, and sticky navigation can obscure the top of the media.

## Approved Design

- Keep the three featured demos in one centered row on desktop widths above 1100px.
- Calculate each featured card width from the smaller of:
  - its equal share of the available content width; and
  - the width of a 9:16 frame that fits below the sticky header within the viewport height.
- Apply the same height-aware calculation to the existing two-column layout from 821px through 1100px.
- Keep the existing single-column mobile layout at 820px and below.
- Use `object-fit: contain` and centered positioning so product framing is never cropped by the page layout.
- Preserve the existing cards, copy, controls, URLs, video sources, and pilot section.

## Responsive Rules

- **1101px and wider:** three equal, height-constrained featured cards centered in the content area.
- **821px to 1100px:** two equal, height-constrained cards; the third remains centered on its own row.
- **820px and narrower:** retain the current full-width, one-column cards for natural mobile scrolling.

## Verification

- Add a regression assertion for viewport-height sizing and contained media.
- Verify the local V4 page at 2048x1071, matching the supplied desktop screenshot proportions.
- Verify a conventional 1280x720 desktop viewport.
- Confirm all three featured videos show their complete 9:16 frame and controls without horizontal overflow.
- Confirm the existing mobile layout and all ten demo links remain unchanged.
