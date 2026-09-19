# PixVerse Platform API Skill Upgrade Design

**Date:** 2026-09-19

**Status:** Approved design

## Objective

Upgrade the existing project-local `pixverse-platform-api` skill so an agent can select and safely execute every documented PixVerse Platform API capability through `pixverse-api platform`, without confusing it with the web `pixverse` CLI or the Growth Studio API.

The skill must cover the complete checked Platform catalog, teach task-oriented capability selection, provide accurate payload guidance, and preserve the CLI's billing, recovery, credential, identifier, and webhook invariants.

## Scope

The upgrade applies to:

- `.agents/skills/pixverse-platform-api/SKILL.md`
- `.agents/skills/pixverse-platform-api/agents/openai.yaml`
- `.agents/skills/pixverse-platform-api/references/`
- catalog-completeness and skill validation tests needed to prevent drift

The provider router remains `pixverse-api`. The Platform and Growth Studio skills remain peers beneath that router. This work does not merge the web `pixverse` CLI with `pixverse-api`, alter the Growth Studio skill, or add new Platform endpoints to the CLI.

## Sources of Truth

Use these sources in descending order when they differ:

1. The current official Platform documentation at `https://docs.platform.pixverse.ai/` for public API meaning, model behavior, current limits, pricing, errors, and webhook semantics.
2. `src/platform/operations.js` and its domain modules for the operations actually supported by this CLI version.
3. `test/fixtures/platform/official-operation-inventory.json` for the independently checked operation inventory.
4. Platform validators and request fixtures for the accepted local payload shape and boundary checks.

The skill must distinguish live, changeable information from versioned CLI behavior. Pricing, models, rate limits, template lists, TTS speakers, and restyle presets must be checked live when the user's task depends on their current values. The skill must not embed the 654-template snapshot as a permanent catalog.

## Capability Boundary

The skill covers all 30 specialized operations and webhook handling.

### Account and billing

- `account.balance`
- `account.usage`

### Uploads, catalogs, and custom voices

- `upload.image`
- `upload.media`
- `resource.templates`
- `resource.tts-speakers`
- `resource.restyle-effects`
- `voice.create`
- `voice.delete`

### Image generation and status

- `image.template`
- `image.status`

### Core video generation

- `video.text`
- `video.image`
- `video.template`
- `video.transition`
- `video.multi-transition`
- `video.fusion`
- `video.avatar`

### Video editing and augmentation

- `video.lip-sync`
- `video.restyle`
- `video.swap-mask`
- `video.swap`
- `video.sound-effect`
- `video.extend`
- `video.motion-control`
- `video.modify`
- `video.upscale`

### Specialized agents and result retrieval

- `agent.viral-recreation`
- `agent.real-estate`
- `video.status`

### Integration behavior

- asynchronous submission and polling
- durable job artifacts and recovery
- webhook signature verification and replay protection
- safe diagnostic use of `platform raw`

## Skill Architecture

Keep the entry point concise and disclose details progressively:

```text
.agents/skills/pixverse-platform-api/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── capabilities.md
    ├── operation-catalog.md
    ├── payload-examples.json
    ├── models-pricing-and-limits.md
    ├── workflows-and-recovery.md
    └── troubleshooting.md
```

No helper script is needed. The CLI already owns deterministic request construction, validation, submission, polling, and recovery. Duplicating those mechanics in a skill script would create a second implementation and increase drift risk.

### `SKILL.md`

The entry point will:

- identify Platform API requests precisely in its description;
- route agents to the correct reference according to the task;
- state the provider and credential boundary;
- define the standard read-only, dry-run, billable, polling, and recovery sequence;
- require current user authorization immediately before a billable submission;
- prohibit automatic resubmission after ambiguous billable outcomes;
- reserve `platform raw` for diagnosis or newly documented endpoints not yet in the specialized catalog;
- retain every `operation:<id>` marker required by the completeness test.

### `references/capabilities.md`

This will be a task-oriented decision guide rather than a second endpoint table. It will explain which capability to choose for common goals and the prerequisite chain for compound workflows such as upload-to-image-video, mask-to-swap, speaker-to-lip-sync, and reference-to-fusion.

It will clearly distinguish:

- prompt-only generation from image-guided generation;
- template effects from free-form model generation;
- first/last-frame transitions from multi-keyframe transitions;
- restyle, modify, swap, motion control, extend, upscale, and sound-effect operations;
- portrait-plus-audio avatar generation from general lip sync;
- general video generation from the two specialized agent workflows.

### `references/operation-catalog.md`

The existing 30-row catalog will be enriched without duplicating full official manuals. Each entry will contain:

- operation marker and CLI command;
- HTTP method and path;
- billing classification and asynchronous behavior;
- response identifier path;
- key prerequisites or input boundary;
- official endpoint documentation URL.

The table must remain traceable to the checked operation inventory.

### `references/payload-examples.json`

The payload reference will contain safe, syntactically valid examples for every operation that accepts a payload or query object. It will use placeholder IDs and `example.test` URLs, never real credentials, account data, or private media.

Examples will preserve resource IDs as strings and demonstrate mutually exclusive source choices correctly. They are recipes for the specialized CLI and must follow the repository validators, even when the upstream API also accepts additional fields not yet supported by this CLI version.

### `references/models-pricing-and-limits.md`

This reference will summarize the official model and capability matrix, relevant resolution/duration/aspect-ratio compatibility, upload limits, rate/concurrency concepts, and credit billing distinctions. It will link to the official model overview, C1, V6, capability matrix, pricing, and rate-limit pages.

Because these values change, the reference will include a verification date and direct the agent to refresh official documentation before making a current compatibility, price, or throughput claim. It will not hard-code volatile pricing as timeless truth.

### `references/workflows-and-recovery.md`

This reference will describe reusable end-to-end flows:

- read-only account and resource discovery;
- upload, submit, poll, and retrieve;
- dry-run and user approval before credit spend;
- durable `run-job` submission;
- `resume` behavior with and without a known result ID;
- status meanings and polling cadence;
- webhook verification before parsing and acknowledgement after delivery;
- diagnostic raw calls without authentication or trace overrides.

### `references/troubleshooting.md`

This reference will connect Platform envelope errors and status values to concrete next actions. It will cover configuration errors, nonzero `ErrCode`, moderation failures, generation failures, trace-ID reuse, rate/concurrency responses, upload validation, missing result IDs, and reconciliation-required outcomes.

It must never recommend blind retry of a billable request.

## Execution and Safety Rules

### Credentials

- Read `PIXVERSE_PLATFORM_API_KEY` only for Platform requests.
- Never fall back to `PIXVERSE_GROWTH_API_KEY` or web-session credentials.
- Never print, persist, or place API keys in payloads or examples.
- Use `https://app-api.pixverse.ai` unless an explicit scoped base URL override is required.

### Trace IDs and identifiers

- Use a fresh `Ai-trace-id` for every new request.
- Reuse a saved trace ID only through the explicit recovery path.
- Preserve API resource identifiers as strings, including large numeric-looking IDs.

### Billable operations

- Treat generation, editing, enhancement, and agent submissions as billable unless the checked catalog says otherwise.
- Validate locally and use `--dry-run` before submission.
- Check current balance or expected credit impact when it materially affects the task.
- Obtain explicit user authorization immediately before a billable live call unless that exact spend was already authorized in the active request.
- Submit once. If the outcome is ambiguous, reconcile or resume; do not silently submit again.

### Polling and delivery

- Poll known job IDs rather than reissuing generation requests.
- Respect current documented rate and concurrency limits.
- Preserve job IDs, trace IDs, artifacts, final URLs, and failure details.
- Verify webhook signatures and replay protection before parsing or acknowledging delivery.

## Error Handling

The skill will teach the agent to treat HTTP success and Platform success separately. A response succeeds only when the request is successful and `ErrCode` is zero.

Errors will be grouped into:

- configuration and authentication;
- input and media validation;
- provider rejection or moderation;
- rate and concurrency pressure;
- transient status polling issues;
- ambiguous billable submission outcomes;
- terminal generation failures.

The prescribed action must be proportional to the error. Read-only requests may be retried when safe. Billable submissions may not be retried automatically after ambiguity.

## Validation Strategy

Implementation will follow a test-first sequence.

1. Extend completeness tests so the skill retains all 30 operation markers and every catalog row includes a valid official documentation URL and result/billing metadata.
2. Add validation for the new reference files and ensure all links from `SKILL.md` resolve.
3. Validate every payload example against the corresponding local operation validator without making network calls.
4. Run the skill validator from the bundled skill-creator tooling.
5. Run the guarded API test suite, full suite, syntax checks, secret scan, dependency audit, and diff checks.
6. Use an independent reviewer to exercise realistic read-only, billable-preflight, recovery, and error-handling prompts without spending credits.

The existing no-paid-network guard must remain active for automated tests. Skill validation must not call the production API or consume credits.

## Acceptance Criteria

- The skill routes all 30 specialized Platform operations and webhook workflows.
- Another agent can select the correct operation from a user goal without reading source code.
- Every payload/query-bearing operation has a safe validated example.
- Dynamic Platform facts are marked for live verification and link to official documentation.
- Platform and Growth Studio credentials, billing, and commands remain isolated.
- Billable calls require appropriate preflight and cannot be duplicated by automatic retry.
- Large resource IDs remain strings throughout examples and instructions.
- Durable recovery and webhook rules match the implementation.
- Catalog, link, payload, skill, security, and repository test gates all pass.
- No credentials, real private media, or paid network calls appear in tests or committed artifacts.
