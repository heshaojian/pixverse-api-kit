# REVOLVE V4 Pitch Corrections

## Goal

Correct the locally staged REVOLVE V4 pitch page before any public update, without changing its videos, product selection, layout, fonts, or visual quality.

## Approved Changes

1. Remove prices from every demo card while retaining product color, because prices are volatile and not material to the pitch.
2. Restore the approved sentence-case headline: “Make every new drop move at REVOLVE speed.”
3. Add Open Graph and Twitter sharing metadata plus a dedicated 1200 × 630 preview image built from the existing REVOLVE and PixVerse branding and real demo imagery.
4. Lazy-load poster images: assign one poster immediately on screens up to 820px wide, three on wider screens, and load the remaining posters shortly before their cards approach the viewport.

## Constraints

- Keep all 10 video URLs, product URLs, names, colors, motion descriptions, and playback settings unchanged.
- Keep the existing JPEG poster files and typography unchanged.
- Do not modify or deploy the public Cloudflare project in this pass.
- Preserve no-JavaScript behavior by exposing descriptive video labels even if posters are unavailable.

## Verification

- Confirm all product card detail lines contain colors and no prices.
- Confirm the sharing image is exactly 1200 × 630 and all social metadata resolves to it.
- Confirm initial poster requests equal one on mobile and three on desktop, then confirm an off-screen poster loads after scrolling.
- Confirm all videos, links, responsive sizing, and accessibility descriptions remain intact.
- Run the full test suite, syntax checks, and desktop/mobile screenshots.
