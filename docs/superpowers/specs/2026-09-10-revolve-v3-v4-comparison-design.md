# REVOLVE V3 vs V4 Comparison Viewer

## Purpose

Create a local, neutral evaluation page for comparing the ten matched REVOLVE product videos generated in V3 and V4. The viewer must make differences in garment fidelity, movement, framing, and soundtrack easy to judge without editorial winner labels.

## Experience

- Show one matched SKU at a time, with V3 on the left and V4 on the right.
- Render both videos in identical 9:16 frames and at the same visual size.
- Provide one shared play/pause command, restart command, and seek timeline.
- Keep playback synchronized by correcting drift when the videos differ by more than 100 milliseconds.
- Provide an audio segmented control with `V3`, `V4`, and `Muted`; only one video may be audible at a time.
- Provide previous/next controls and a ten-product selector.
- Show the product name, SKU, color, price, V3 model/resolution/duration, and V4 model/resolution/duration.
- Provide a collapsible reference strip using the authoritative product images already stored in the workspace.
- Preserve the selected SKU and audio mode in the URL hash so the page can be reopened at the same comparison.

## Visual Direction

Use the PixVerse dark interface system: pure black canvas, white-alpha depth, Plus Jakarta Sans, Inconsolata for technical values, 8px control radius, and no decorative gradients or shadows. The videos are the primary visual signal. Controls remain compact and utilitarian.

Desktop uses a two-column comparison. Mobile stacks V3 above V4 while retaining the shared controls and product selector. Labels and controls must never overlap the media.

## Data

The page reads a local comparison manifest containing ten products. Each record contains:

- Product identity and metadata
- V3 and V4 local video paths
- V3 and V4 technical metadata
- Product reference image paths

The manifest is generated from existing V3/V4 artifacts. No API keys, job logs, private workspace identifiers, or absolute user paths are included.

## Playback Rules

- Shared play starts both videos from the same normalized position.
- Seeking maps the selected normalized position to each video's own duration.
- During playback, V3 is the timing leader and V4 is corrected to the equivalent normalized position when drift exceeds 100 milliseconds.
- When one video reaches its end, both pause at their respective ends.
- Switching products pauses playback and loads both videos at time zero.
- Audio selection changes mute state without restarting playback.

## Error Handling

- If one video fails to load, keep the other usable and show a concise inline failure state for the missing side.
- Disable shared playback until both videos have enough metadata to synchronize.
- Missing reference images are omitted without breaking the product view.

## Verification

- Unit-test manifest completeness, unique ten-SKU mapping, local path safety, and V3/V4 model metadata.
- Test shared playback, pause, restart, seek, audio switching, product navigation, and hash restoration in the browser.
- Verify desktop and mobile screenshots for equal media sizing, readable controls, and no overlap.
- Confirm no autoplay, no external publication, and no secret or absolute local path exposure.
