# REVOLVE V4 Lazy Poster Loading

## Goal

Reduce initial network contention on mobile and desktop without changing poster quality, typography, video preload behavior, layout, or customer-facing content.

## Design

- Replace each video's eager `poster` attribute with an equivalent `data-poster` value so the browser does not fetch all ten posters during HTML parsing.
- On page initialization, assign real poster URLs to the first visible set: one video on screens up to 820px wide and three videos on wider screens.
- Observe the remaining videos with `IntersectionObserver` and assign each poster shortly before its card approaches the viewport.
- Use a moderate vertical preload margin so posters are ready before normal scrolling reaches them.
- Fall back to assigning every poster immediately when `IntersectionObserver` is unavailable.

## Constraints

- Keep the existing JPEG files and their visual quality.
- Keep all current video URLs and `preload` values unchanged.
- Preserve the 9:16 responsive sizing and mobile header behavior.
- Do not deploy until the local implementation passes tests and a throttled before/after benchmark.

## Verification

- Confirm only one poster is requested initially at 390px width and three at 1440px width.
- Confirm deferred posters load when their cards approach the viewport.
- Confirm video controls, playback, poster display, and responsive framing still work.
- Run the full repository test and syntax-check suites.
