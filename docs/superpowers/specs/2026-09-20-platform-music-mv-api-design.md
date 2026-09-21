# PixVerse Platform Music MV API Design

## Goal

Add the new One-Click Music MV workflow to the existing `pixverse-api platform` namespace as two specialized, validated operations while preserving Platform credential isolation, durable billable-job recovery, and the distinction from both the web `pixverse` CLI and `pixverse-api growth-studio`.

## Source and Scope

The contract source is the Feishu specification `[Oneclick MV] One-Click Video Generation Interface Document`, document ID `PsBydWQefoNPpAx8DCscJt6unfb`, revision 377, reviewed on 2026-09-20.

This change includes:

- synchronous audio verification;
- asynchronous Music MV generation;
- operation-specific validation;
- catalog, CLI help, examples, skill references, troubleshooting, pricing, and capability documentation;
- offline unit, contract, integration, catalog, and skill tests.

This change does not submit a paid generation, expose credentials, change Growth Studio behavior, or add a second status endpoint. Music MV jobs reuse the existing Platform video-result polling and recovery flow.

## Considered Approaches

### 1. First-class `audio` and `agent` operations — selected

Expose `platform audio verify` and `platform agent music-mv`. This reflects the verification prerequisite and treats One-Click MV consistently with the existing viral-recreation and real-estate agents. Both operations participate in the checked catalog, specialized validation, documentation, and job safety controls.

### 2. Put generation under `platform video music-mv`

This follows the HTTP path but hides the product's agent semantics and would make agent discovery inconsistent with existing one-click workflows.

### 3. Leave both endpoints behind `platform raw`

This is fastest but violates the repository requirement that every documented specialized Platform endpoint receive a discoverable, validated command. Raw access remains a diagnostic fallback, not public coverage.

## Public Commands and Operation Records

### Audio verification

```text
pixverse-api platform audio verify --payload /absolute/path/audio-verification.json
```

Operation record:

- ID: `audio.verify`
- Method: `POST`
- Path: `/openapi/v2/audio/verification`
- Body mode: JSON
- Billing: non-billable
- Asynchronous: no
- Result ID: none
- Documentation: `https://aisphere.feishu.cn/wiki/L8pgwGoSwiDbQ8ksGIHcppcvnrc`

Required payload:

```json
{
  "audio_media_id": "405833376854443"
}
```

The media ID must be retained as a decimal string locally to avoid JavaScript precision loss. The Platform client continues to own `API-KEY`, `Ai-trace-id`, and `Content-Type` headers.

### Music MV generation

```text
pixverse-api platform agent music-mv --payload /absolute/path/music-mv.json --dry-run
pixverse-api platform run-job --operation agent.music-mv --payload /absolute/path/music-mv.json --poll
```

Operation record:

- ID: `agent.music-mv`
- Method: `POST`
- Path: `/openapi/v2/video/music_mv_agent/generate`
- Body mode: JSON
- Billing: billable
- Asynchronous: yes
- Result ID: `Resp.video_id`
- Polling: existing `video.status` operation
- Documentation: `https://aisphere.feishu.cn/wiki/L8pgwGoSwiDbQ8ksGIHcppcvnrc`

The durable job layer submits exactly once, records the trace and returned video ID, and uses the existing resume command after interruption or ambiguous state.

## Workflow

1. Upload an audio file with `platform upload media` and retain `Resp.media_id`.
2. Verify that ID with `platform audio verify`.
3. If used, upload one character image and/or one style image with `platform upload image`.
4. Check Platform balance before generation when cost affects the decision.
5. Validate the Music MV payload locally with `--dry-run`.
6. Submit exactly once through `platform run-job --operation agent.music-mv`.
7. Poll or resume through the existing video-result workflow; never resubmit merely to recover status.

Audio verification returning `ErrCode: 0` is treated as a successful verification response. A generation response returning `Resp.video_id` becomes a normal durable Platform video job.

## Music MV Validation Contract

### Required fields

- `mv_agent_type`: a non-empty string. The source document conflicts between `vibe_mv` and `vibe_mv_v3_custom`, so the CLI accepts those two documented values and does not invent a default. Published examples use `vibe_mv_v3_custom`, which is the value named by the new contract table and validation errors.
- `audio_media_id`: a positive decimal identifier string.
- `aspect_ratio`: one of `16:9`, `9:16`, `1:1`, `4:3`, or `3:4`.
- `quality`: `720p` or `1080p`.

### Optional enumerations and scalars

- `music_style`: case-insensitive match for `Pop`, `Rock`, `HipHop`, `R&B`, `Jazz`, `Reggae`, `Country`, `Folk`, `Electronic`, `Classical`, `Soul`, `Funk`, `Metal`, `Ambient`, or `Others`.
- `mv_style`: case-insensitive match for `Custom`, `Cinematic`, `Lo-fi`, `Dreamscape`, `Woolen Felt`, `Candy`, `Vintage`, `Voxel`, `Retro Game`, `Claymation`, `Woodland Tale`, `Impressionism`, `Decadence`, `Futuristic`, `Chromatic Clash`, or `Holiday`.
- `caption_switch`, `lip_sync_switch`, and the example-only `instrumental_switch`: booleans when provided.
- `seed`: a non-negative integer when provided.
- `lyric_text`: a string shorter than 5,000 characters.

The source states that lip-sync fails for instrumental audio. Because local validation cannot reliably infer whether an uploaded remote audio ID contains vocals, the CLI documents this constraint but leaves content recognition to audio verification and generation.

### Image references

The source alternates between `img_references` and `image_references`. The CLI accepts either spelling at its input boundary, rejects payloads containing both, and normalizes `image_references` to the established Platform field `img_references` before request creation. It never emits both fields.

`img_references` and `style_img_references` must each be arrays with no more than one reference. Every reference requires a positive decimal `img_id` string and may include a string `ref_name`. When `mv_style` is `Custom`, at least one of those two arrays must contain a reference; when the style-specific array is absent, the character reference may serve as the style reference as documented.

Uploaded image constraints remain 20 MB maximum, JPG/PNG/WebP, and at most 10,000 by 10,000 pixels. Existing upload validation enforces those local-file limits.

### Timestamped lyrics

`lyric_timestamp`, when supplied, must be an object containing a `words` array. Each word contains finite numeric `start` and `end` values and a non-empty string `word`. Entries must be non-overlapping and monotonically increasing, with `0 <= start <= end`. The array and concatenated text are each limited to 5,000 units. If both lyric forms are present, `lyric_timestamp` takes precedence, matching the source contract.

The Platform service remains responsible for checking timestamps against the uploaded audio duration because the payload contains only a remote media ID.

## Source Ambiguities and Compatibility Policy

The implementation records, rather than conceals, these inconsistencies:

- `img_references` versus `image_references` is handled through a single safe alias normalization.
- `vibe_mv` and `vibe_mv_v3_custom` are both accepted, while examples recommend the new `vibe_mv_v3_custom` value.
- `instrumental_switch` and `seed` are accepted because they appear in the official request example, but they remain optional.
- The result-section typo `/audio/verificationo` is ignored in favor of the interface definition and request example path `/openapi/v2/audio/verification`.
- “Concurrent Occupancy: 10 per call” is documented as a provider concurrency limit of 10, not interpreted as ten generations in one request.

No validator silently changes styles, quality, aspect ratio, switches, lyrics, or the MV agent type.

## Pricing and Limits

- Audio duration: 10 to 360 seconds.
- Audio file size: at most 15 MB.
- 720p: 15 credits per second, with duration rounded up.
- 1080p: 1.5 times the 720p rate, equivalent to 22.5 credits per second according to the reviewed document.
- Provider concurrency: 10.
- Aspect ratios: five documented values.
- Visual choices: fifteen built-in styles plus `Custom`.

Pricing and concurrency are documentation snapshots, not hardcoded billing calculations used to authorize spending. A live balance check and explicit generation request remain required before a production submission.

## File Boundaries

- `src/platform/operations/audio.js`: audio-specific operation definitions.
- `src/platform/operations/agents.js`: add the Music MV generation operation beside existing agent operations.
- `src/platform/operations.js`: compose the two records and attach documentation provenance.
- `src/platform/validators/specialized.js`: route the two new operation policies.
- `src/platform/validators/music-mv.js`: normalize aliases and validate Music MV payloads without expanding the already broad specialized validator.
- `test/fixtures/platform/official-operation-inventory.json`: independent 32-operation catalog snapshot.
- `test/fixtures/platform/audio.verify/` and `test/fixtures/platform/agent.music-mv/`: success and failure contract fixtures.
- `.agents/skills/pixverse-platform-api/`: capability, catalog, payload, pricing, workflow, and troubleshooting updates.
- `docs/api/`: command and operation documentation updates.

No unrelated refactor is included.

The catalog's documentation URL invariant is widened only enough to allow the reviewed Feishu source for these two operations. Existing entries continue to require `docs.platform.pixverse.ai`; no public documentation URL is invented for an interface that has not yet been published there.

## Error Handling and Safety

- Nonzero Platform envelopes remain errors even when HTTP returns success.
- Audio verification errors such as missing media, ownership failure, moderation rejection, and invalid content are surfaced without retry.
- Music MV validation errors are rejected before network access.
- Paid submission is never automatically retried.
- `701020` directs the user to verify the audio; it does not trigger verification followed by an implicit paid retry.
- `500044` reports provider concurrency exhaustion and preserves the saved job state.
- Moderation failures (`500063`) and invalid lyrics (`400080`) stop the workflow for user correction.
- No API key or authentication header appears in examples, fixtures, job artifacts, or logs.

## Testing Strategy

Tests are written before implementation and run behind the existing no-paid-network guard.

1. Catalog tests fail until exactly 32 specialized operations exist and the new method/path/billing/async metadata match the reviewed contract.
2. Unit tests cover required fields, decimal-string identifiers, aliases, duplicate aliases, enum handling, custom-style reference requirements, reference cardinality, switches, seed, lyric limits, and monotonic timestamp validation.
3. Contract tests verify request normalization, Platform envelopes, exact-string video IDs, and reuse of the video status endpoint.
4. Integration and end-to-end tests verify audio upload-to-verification routing and durable Music MV job creation/resume without paid network traffic.
5. Skill tests require both operations, their prerequisite chain, pricing snapshot, error guidance, and synthetic examples.
6. Full verification runs coverage, API tests, static checks, security scan, dependency audit, and diff whitespace checks.

The acceptance threshold remains at least 80 percent coverage for lines, branches, functions, and statements, with all guarded suites passing.

## Acceptance Criteria

- Both commands appear in `pixverse-api platform --help`.
- The independent catalog contains 32 operations and matches the runtime catalog.
- Audio verification is non-billable and synchronous.
- Music MV generation is billable, asynchronous, and recoverable through the existing video job lifecycle.
- The CLI catches documented invalid inputs before network access without inventing values for ambiguous fields.
- The Platform API skill explains discovery, prerequisites, pricing, limits, errors, and safe execution.
- Tests perform no paid or credential-bearing network request.
- Growth Studio and web CLI behavior remain unchanged.
