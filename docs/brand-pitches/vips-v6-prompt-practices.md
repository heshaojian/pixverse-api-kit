# VIPS V6 Prompt Practices

This guide summarizes the V6 prompt lessons from the human-reviewed VIPS ecommerce tests, revision 1214. It is meant to help future VIPS-facing examples use the strongest V6 patterns while avoiding failure modes already seen in review.

Keep this as prompt and QA guidance, not as a customer-facing claim. The reviewed tests show where V6 is useful, where it is only partially useful, and where an Agent workflow or storyboarded production route is a safer choice.

## Best-Fit Uses

| Workflow | V6 fit | Prompt implication |
| --- | --- | --- |
| Single-shot product replacement | Partial to strong | Use the original clip as motion authority, then attach SKU references for the replacement object. Expect motion following to be stronger than text/logo preservation. |
| Product-page motion loops | Strong | Make the first image the only visual master, use other references only for pose or action, and return exactly to the first frame. |
| Simple product presentation | Partial | Keep one action per shot, write explicit no-speaking/no-lip-sync constraints, and avoid demonstrations that require a chain of precise hand operations. |
| Person or background replacement | Partial | Make the requested edit the primary instruction, explicitly lock product color and texture, and handle captions or exact text separately. |
| Multi-step functional demonstration | Weak | Reduce each shot to one physical action or route the job to an Agent workflow. Zippers, pockets, steam, and multi-prop sequences remained unreliable. |
| Creative commercial effects | Not reliable as direct V6-only work | Use Agent or storyboarded workflows for shot design. V6 direct output can lose physical logic, final composition, or packaging text. |

## Core Prompt Rules

### 1. Assign authority to every reference

Do not let the model infer that every reference controls everything. The strongest VIPS prompts clearly separate reference roles:

- `@video1` controls motion timing, camera rhythm, and hand/body action.
- `@image1` controls the product, identity, clothing, accessories, background, lighting, and start/end frame.
- Later images control only body pose, gesture, or action shape.
- Product references override pose references when the two conflict.
- The prompt says which reference information must be ignored, not only which information should be followed.

For product motion, the recurring winning pattern is: image one is the only visual master; image two or later images are pose references only.

### 2. Lock product truth before asking for motion

The VIPS examples worked best when the prompt described locked details before the action:

- Same model, same primary garment, same product, same background, same color tone, same lighting.
- Product and accessory position, orientation, wearing method, size, shape, color, material, logo, and visual state stay fixed from the visual master.
- If a pose reference would move a bag, hat, shoe, logo, gift box, or accessory away from its master state, keep the master state and adapt the body action.
- Clothing can wrinkle or drape naturally, but style, structure, cut, length, color, material, texture, logo, text, and decoration stay consistent.

The important prompt habit is to define what can move and what cannot move. "Make it natural" is not enough.

### 3. Use continuous motion language for loops

For ecommerce page motion, the reviewed prompts repeatedly used one continuous take:

```text
One complete continuous shot. No cuts, no edits, no jumps, no pause, no freeze frame, no sudden pose switch, no camera shake.

Image one is the only visual master and the fixed start and end frame. The model moves naturally from image one into the pose reference, then continues naturally back to image one. The final frame must match image one exactly: pose, vertical scale, product/accessory state, camera position, framing, background, environment, and lighting.
```

For multi-pose loops, do not force the pose references in file order. Ask the model to extract each reference's recognizable pose features, then choose the most natural order for continuous human motion. This avoids sudden snapping between poses.

### 4. Lock the vertical scale

The VIPS product-scene prompts were unusually explicit about scale, and that matters. When later references have different crops or distances, tell V6 to ignore those differences:

- The person's head-to-foot height, headroom, lower body crop, and vertical framing scale follow image one for the full clip.
- Full-body, half-body, close-up, larger, or smaller pose references provide only action, not camera distance.
- Camera movement cannot zoom, push in, pull out, or change the person's vertical scale.

This is especially useful for ecommerce loops where the first and last frame must match.

### 5. Prefer direct final-state actions over complex physical sequences

The VIPS review warns against long chains of hand and body operations. A better prompt asks for the visible result or a simple one-step action:

- Better: "Shot 1: close-up of the character already holding the product. Shot 2: close-up of smoke rings leaving the mouth."
- Risky: "Open the package, take out the object, light it, put away the lighter, then exhale."

This applies to lacing shoes, steaming fabric, unboxing, applying skincare, opening boxes, and any multi-step product demonstration.

### 6. Describe mechanics and state transitions

Name the physical start state, contact, movement path, and end state instead of only naming the desired result.

Weak:

> The model puts on the hood.

Stronger:

> Both hands grasp the hood edge behind the head and continuously pull it forward over the head. The jacket front remains open throughout the action.

Weak:

> Show that the zipper works smoothly.

Stronger:

> The jacket begins fully open. The right hand visibly grips the zipper pull at the bottom and moves it continuously upward to the collar while the zipper teeth close progressively below it.

Useful mechanical constraints include:

- Hands remain visibly in contact with the manipulated object.
- Objects do not appear, disappear, duplicate, or teleport.
- Only one model appears and no extra hands enter the frame.
- Product and prop state remain consistent in the following shot.

These constraints improved individual actions in review, but they did not make dense zipper, pocket, steam, or multi-prop demonstrations fully reliable.

### 7. Rank constraints and split conflicting goals

V6 may satisfy one requirement by sacrificing another. The reviewed retries showed stronger background instructions damaging product identity, stronger color locks weakening the background edit, and subtitle-removal instructions changing garment details.

Use this default priority:

1. Product and SKU consistency
2. Person and accessory consistency
3. Natural physical motion
4. Pose similarity
5. Camera movement and atmosphere

When two difficult requirements must both be exact, such as complete background replacement and exact packaging text, split them into separate generation or post-production stages.

## Workflow-Specific Guidance

### Single-shot editing with V6 reference mode

Use V6 reference mode when the task is: keep one original shot and replace a product, garment, person, or background.

Prompt pattern:

```text
Use @video1 as the motion and camera reference. Keep the original shot timing, hand movement, body movement, camera movement, framing, and rhythm.

Replace only [target object] with the product shown in @image1-@imageN. Keep all other content unchanged unless explicitly listed below.

[If relevant] Hand movement and object path follow the original video exactly.
[If relevant] The replacement product keeps its SKU color, material, silhouette, logo placement, and visible construction.
```

Known limits from review:

- Burned-in captions, corner marks, prices, and subtitles often remain. If removal is required, plan a subtitle-removal step instead of relying on V6.
- Small text can become unreadable or turn into pseudo-text.
- Background replacement can change foreground clothing color, texture, or material.
- Extra rounded output duration can create trailing frames with corrupted text; trim and QA the tail.
- Constraints about color can compete with background replacement. Put the highest-priority requirement first and review whether the model sacrificed another requirement.
- Warm backgrounds can shift off-white garments toward yellow or khaki and turn matte fabric glossy. Prefer neutral white light, overcast daylight, or even diffuse illumination when product color and texture are acceptance criteria.

### Product-page motion loops

Use this for PDP-style motion from one or more still images.

Prompt pattern:

```text
Image one is the only visual master and the seamless loop start/end frame. Images two through N are only body pose references.

Keep image one's model identity, main clothing, product, accessories, background, color tone, lighting, camera position, framing, headroom, body crop, and vertical scale throughout.

Extract the recognizable pose features from each later image: body direction, center of gravity, shoulder state, arm position, hand pose, head direction, and overall posture. Ignore their background, product state, accessories, crop, camera distance, and lighting.

The model moves through these poses with natural continuous body motion, then returns gradually to image one. The final frame exactly matches image one.
```

Camera guidance:

- Fixed tripod works when product fidelity matters most.
- A stabilizer or mechanical slider can add a slight smooth follow or small arc.
- Avoid pure zooming, large orbiting, drifting, shake, sudden perspective changes, or any move that changes vertical scale.

### Product demonstration and presenter-style clips

The VIPS tests show that product selling clips need explicit behavioral constraints. If a video should be silent, say so in the prompt even when audio is disabled:

```text
Silent product demonstration. The model does not speak, lip-sync, look like they are presenting to camera, or wear a microphone.
```

For physical demonstrations:

- Put tool/object placement in the shot text, not only in the concept. Example: "The steamer reaches inside the T-shirt and releases steam through the fabric."
- Protect visual anchors: "The embroidery stays fixed on the left chest and appears only once."
- Limit the shot to one clear action. Complex hand interactions should go to Agent or storyboarded workflows.

### Delivery parameters and deterministic finishing

Prompt language does not override generation settings. The reviewed prompts requested “8K,” while the actual V6 outputs were generated at 720p. Configure aspect ratio, resolution, duration, audio, and candidate count through generation parameters.

Use deterministic finishing for details V6 did not preserve reliably:

1. Generate or edit the visual motion.
2. Remove existing subtitles or watermarks in a dedicated step when required.
3. Reapply exact subtitles, prices, logos, legal copy, and end cards in post-production.
4. Trim to the exact approved duration and inspect the final frames.

For high-value shots, generate more than one candidate and select through human review. In the reviewed shoe-replacement test, all three V6 candidates completed, but one was visibly stronger and another introduced background drift.

### Creative commercial effects

Direct V6 prompts are weaker for multi-stage effects such as assembling a shoe from parts, laser-carving details, skincare macro-to-face transitions, or luxury gift-box unboxing. The reviewed VIPS results favored Agent or newer storyboarded workflows because they can plan shots first.

If V6 is used anyway:

- Break the ad into numbered shots.
- Attach the correct reference to each shot, not just to the whole prompt.
- Transcribe packaging text and logo placement, but still treat exact small text as a QA risk.
- Avoid requiring precise hand-object physics across several shots.
- Review final composition and physical plausibility, not just whether the requested elements appear.

## Common Failure Modes To Gate

Every V6 output for VIPS-style ecommerce should be reviewed for:

- Product color, material, texture, silhouette, and construction drift.
- Logo, packaging, subtitle, price, and small-text corruption.
- Background leakage from a pose reference into the master scene.
- Product/accessory movement that violates the master image.
- Scale drift, zooming, headroom changes, or crop changes in a loop.
- Extra props, duplicate people, unexpected microphones, or speaking behavior.
- Hand-object interaction errors, especially tying, steaming, opening, applying, or holding.
- Tail-frame artifacts from duration rounding.
- Whether the last frame truly returns to the first frame for loop use.

## How This Differs From REVOLVE

The [REVOLVE workflow](revolve-video-generation-workflow.md) is a controlled batch pipeline: product truth package, storyboard, music, video generation, packaging, and release QA.

The VIPS V6 lesson is more prompt-time and workflow-selection focused. It shows that V6 can be very useful when reference authority is precise, but it should not be treated as a universal "keep everything else unchanged" engine. For VIPS-style ecommerce, the prompt must name the visual master, motion-only references, locked product details, allowed motion, prohibited leakage, and release gates before generation starts.

Use both documents together: REVOLVE explains the production pipeline; this guide explains how to shape V6 prompts and decide when V6 is not the right primary tool.
