# PixVerse Platform and Growth Studio API CLI Design

## Summary

`pixverse-api-kit` will provide one server-API command-line interface, `pixverse-api`, with two explicit provider namespaces:

```text
pixverse-api platform ...
pixverse-api growth-studio ...
```

The existing `pixverse` CLI remains a separate product. It mirrors the PixVerse web experience and uses the web account's OAuth session and subscription credits. `pixverse-api` is for official server APIs that use API keys and provider-specific billing.

This separation is intentional:

| Surface | Command | Purpose | Authentication and billing |
| --- | --- | --- | --- |
| PixVerse CLI | `pixverse ...` | PixVerse web functionality | OAuth and web subscription credits |
| Platform API | `pixverse-api platform ...` | General developer API | Platform API key and Platform credits |
| Growth Studio API | `pixverse-api growth-studio ...` | Product and marketing video workflows | Growth Studio API key and Growth Studio credits |

## Goals

- Make Platform API and Growth Studio API first-class peers in one API-focused CLI.
- Cover every operation published in the current Platform API reference, including specialized workflows.
- Preserve all existing Growth Studio capabilities and durable job behavior.
- Make the provider and associated credit pool explicit before every potentially billable operation.
- Validate known constraints before network access and never leak API keys.
- Preserve enough local evidence to reconcile ambiguous asynchronous requests without duplicate spend.
- Provide separate provider skills plus a lightweight router skill for agents.
- Maintain at least 80% automated test coverage without issuing paid jobs in the default test suite.

## Non-goals

- Replacing, wrapping, or changing the existing `pixverse` web CLI.
- Sharing credentials or credits between Platform API and Growth Studio API.
- Scraping undocumented private endpoints.
- Automatically creating Platform webhooks when no official webhook-management endpoint is published.
- Automatically resubmitting an ambiguous or timed-out billable request.
- Generating a client from scraped documentation. The public documentation does not currently expose a complete downloadable OpenAPI document.

## Product and Naming Model

The repository and npm package remain `pixverse-api-kit`. The installed binary remains `pixverse-api`.

The canonical namespaces are:

```text
pixverse-api platform <resource> <operation>
pixverse-api growth-studio <resource> <operation>
```

The canonical agent skills are:

- `pixverse-api`: routes an API request to the correct provider and explains the billing boundary.
- `pixverse-platform-api`: covers Platform API commands, payloads, statuses, limits, and recovery.
- `pixverse-growth-studio-api`: covers Growth Studio commands, folders, product-video payloads, statuses, and recovery.

The existing unnamespaced Growth Studio commands remain compatibility aliases throughout the package's `0.x` releases. They print a deprecation notice to standard error and delegate without changing behavior. They may be removed only in `1.0.0` or a later major release. Documentation and skills use only the namespaced form.

Examples:

```text
pixverse-api platform account balance
pixverse-api platform upload image ./reference.png
pixverse-api platform video text --payload ./text-video.json
pixverse-api platform video status 627410861853514292
pixverse-api platform run-job --operation video.image --payload ./image-video.json

pixverse-api growth-studio avatars list
pixverse-api growth-studio folders ensure REVOLVE
pixverse-api growth-studio video create-from-url https://shop.example.com/item
pixverse-api growth-studio video status 627410861853514292
pixverse-api growth-studio run-job --payload ./product-video.json
```

## Architecture

The implementation is split into shared infrastructure and isolated provider modules:

```text
src/
  cli.js                         top-level provider router and compatibility aliases
  core/
    artifacts.js                 atomic, redacted job artifact writing
    errors.js                    normalized CLI error taxonomy
    http.js                      transport primitives and Retry-After parsing
    polling.js                   provider-neutral bounded polling loop
    redaction.js                 recursive secret and sensitive-header removal
    trace.js                     fresh trace identifiers
  platform/
    cli.js                       Platform command tree
    client.js                    Platform request methods
    config.js                    Platform-only configuration
    envelope.js                  ErrCode/ErrMsg/Resp handling
    jobs.js                      Platform job submission and reconciliation
    operations.js                canonical documented-operation registry
    status.js                    numeric Platform status mapping
    validation.js                common and operation-specific validation
  growth-studio/
    cli.js                       namespaced Growth Studio command tree
    client.js                    existing Growth Studio client behavior
    config.js                    Growth Studio-only configuration
    folders.js                   folder resolution and creation
    jobs.js                      existing Growth Studio job workflow
    validation.js                Growth Studio payload validation
```

Shared modules contain only behavior that is truly provider-neutral. Authentication headers, API envelopes, payloads, endpoint paths, task statuses, and billing semantics remain inside their provider modules.

All payload transformations return new objects. Callers' payload objects are never mutated.

## Configuration and Authentication

Platform API configuration:

```text
PIXVERSE_PLATFORM_API_KEY=...
PIXVERSE_PLATFORM_BASE_URL=https://app-api.pixverse.ai
```

Growth Studio API configuration remains:

```text
PIXVERSE_GROWTH_API_KEY=mh_live_...
PIXVERSE_GROWTH_BASE_URL=https://growth-api.pixverse.ai
PIXVERSE_GROWTH_FOLDER_API_PREFIX=/marketing_hub
PIXVERSE_GROWTH_FOLDER_API_KEY=...
```

Configuration rules:

- Provider commands load and validate only their provider's configuration.
- A missing key produces a provider-specific setup error before network access.
- A Platform key never falls back to a Growth Studio key, or vice versa.
- Platform requests use `API-KEY` and a fresh UUID in `Ai-trace-id`.
- Growth Studio requests retain their existing bearer-token behavior.
- API keys and authorization headers are redacted from output, errors, logs, and artifacts.
- Base URL overrides are supported for local contract tests and controlled deployments.

## Platform Operation Coverage

`src/platform/operations.js` is the single checked catalog for every operation published in the official Platform API navigation as of September 18, 2026. Each entry records its stable CLI name, HTTP method, path, body mode, validation policy, billing classification, asynchronous-result behavior, and documentation URL.

The initial catalog covers:

### Account and usage

- Get user credit balance.
- Query usage deductions.

### Uploads and reusable inputs

- Upload image from a local file or supported URL input.
- Upload video or audio from a local file or supported URL input.

### Catalogs and supporting resources

- Get template list.
- Get speech/lip-sync TTS speaker list.
- Get restyle effect list.
- Create custom voice.
- Delete custom voice.

### Video generation and editing

- Text-to-video generation.
- Image-to-video generation.
- Template video generation.
- First/last-frame transition generation.
- Multi-transition generation.
- Speech/lip-sync generation.
- Fusion/reference-to-video generation.
- Restyle generation.
- Swap-mask generation.
- Swap-video generation.
- Sound-effect generation.
- Extend generation.
- Motion Control/Mimic generation.
- Modify generation.
- Upscale video.
- Avatar generation.
- Viral Recreation Agent.
- One-click Real Estate Video.
- Get video-generation status.

### Webhook support

- Verify Platform webhook signatures.
- Parse and normalize webhook deliveries.
- Document use of a dashboard-created `webhook_id` in supported generation requests.

The webhook receiver returns the exact body `ok` only after signature verification and payload acceptance. The CLI does not claim to create or administer webhook registrations without a published official endpoint.

The catalog is deliberately data-driven, but validation remains operation-specific. A generic `platform raw` command exists for forward compatibility and diagnosis; it requires an explicit method and `/openapi/v2/` path, redacts secrets, defaults to no automatic retry, and is never counted as coverage for a currently documented endpoint.

## Command and Input Design

Every specialized operation has:

- A discoverable command in `pixverse-api platform --help`.
- A concise command form for essential identifiers and local file paths.
- `--payload <path>` for the complete official JSON request shape.
- `--dry-run` for validation and redacted normalization without network access.
- `--json` for stable machine-readable output.
- `--trace-id` only for safe reconciliation of a known prior request; new billable submissions reject caller-supplied trace reuse unless an explicit recovery command is used.

Billable operations default to submit once and return the saved job record. `platform run-job` may poll to a terminal result when requested. It never hides the submitted trace ID or video ID.

Uploads save reusable IDs and URLs. Later commands accept those IDs rather than uploading the same input again.

## Platform Request and Response Flow

For a new Platform operation:

1. Parse the provider, resource, and operation.
2. Load Platform-only configuration.
3. Read the payload or command arguments.
4. Normalize into a new object and validate documented constraints.
5. Build a redacted request preview.
6. Create a fresh UUID trace ID.
7. Atomically create the job directory and write `request.json` before submission.
8. Submit exactly once using `API-KEY` and `Ai-trace-id`.
9. Parse `{ ErrCode, ErrMsg, Resp }`; a nonzero `ErrCode` is an API failure even when HTTP status is successful.
10. Save `create-response.json` and any returned `video_id` as a string.
11. If polling is requested, call the status endpoint every three to five seconds while respecting `Retry-After`.
12. Stop on success, deletion, moderation failure, generation failure, or the configured timeout.
13. Save every snapshot and the final normalized result without discarding the original envelope.

Current Platform status normalization is:

| API status | Normalized status |
| --- | --- |
| `1` | `succeeded` |
| `5` | `processing` |
| `6` | `deleted` |
| `7` | `moderation_failed` |
| `8` | `failed` |

Unknown statuses remain `unknown` and preserve their raw value. They do not trigger resubmission.

## Durable Job Artifacts

Each new billable job receives a timestamped directory. Its artifacts are:

- `request.json`: provider, operation, documentation URL, trace ID, redacted headers, and normalized payload.
- `create-response.json`: original response envelope.
- `video-id.json`: string-preserved video ID when present.
- `polling.jsonl`: append-only status snapshots.
- `final.json`: terminal normalized result or the last known state on timeout.
- `error.json`: normalized error plus safe provider details when the command fails.

Artifact writes are atomic. Existing artifacts are not silently overwritten. Resume and reconciliation commands read these files before making network requests.

## Validation

Validation happens at system boundaries and is layered:

- Shared validation checks object shape, required fields, string-preserved IDs, supported input modes, local file existence, and safe paths.
- Media validation checks published format, file-size, dimension, and duration limits before upload.
- Model-aware validation checks supported models, qualities, durations, aspect ratios, prompt lengths, seeds, reference counts, and operation compatibility.
- Operation validation enforces required ID combinations such as transition frames, fusion references, swap mask inputs, voice inputs, or source video IDs.
- Unknown payload fields are preserved for forward compatibility unless the official endpoint rejects them; validation never drops caller data silently.
- Error messages identify the invalid field, accepted constraint, provider, and operation without exposing secrets.

## Error Model and Retry Policy

The CLI exposes distinct error categories:

- configuration and authentication;
- local input and validation;
- transport and timeout;
- rate limit and concurrency;
- provider envelope error;
- moderation failure;
- generation failure;
- deleted resource;
- polling timeout;
- artifact persistence failure;
- webhook verification failure.

Read-only requests may retry retryable transport failures with bounded exponential backoff. Uploads and billable generation/edit operations are never automatically retried after an ambiguous response. The operator must reconcile through the saved trace ID, video ID, or job artifacts first.

## Growth Studio Migration

Existing Growth Studio behavior is moved behind the `growth-studio` namespace without functional changes. The migration preserves:

- avatar listing;
- folder listing and ensure/create behavior;
- image upload;
- product URL and JSON creation;
- video details, polling, listing, and editing;
- durable `run-job` artifacts;
- numeric-string video and folder IDs;
- current folder token and prefix overrides.

Compatibility aliases map the old commands to the new namespace throughout the package's `0.x` releases and may be removed only in `1.0.0` or a later major release:

```text
pixverse-api avatars              -> pixverse-api growth-studio avatars list
pixverse-api folders              -> pixverse-api growth-studio folders list
pixverse-api ensure-folder NAME   -> pixverse-api growth-studio folders ensure NAME
pixverse-api upload-image PATH    -> pixverse-api growth-studio upload image PATH
pixverse-api create-from-url ...  -> pixverse-api growth-studio video create-from-url ...
pixverse-api create-from-json ... -> pixverse-api growth-studio video create-from-json ...
pixverse-api get ID               -> pixverse-api growth-studio video get ID
pixverse-api poll ID              -> pixverse-api growth-studio video poll ID
pixverse-api list ...             -> pixverse-api growth-studio video list ...
pixverse-api edit ...             -> pixverse-api growth-studio video edit ...
pixverse-api run-job ...          -> pixverse-api growth-studio run-job ...
```

## Skills and Documentation

The router skill explains the three-product boundary and selects one of the two API provider skills. It never routes a server-API request to the separate web CLI as a convenience fallback.

The Platform skill includes:

- setup and environment variables;
- endpoint and command catalog;
- payload examples for every specialized operation;
- model and media constraints;
- billing and dry-run guidance;
- upload reuse;
- polling, resume, and reconciliation procedures;
- webhook verification;
- explicit warnings that Platform credits are separate from web and Growth Studio credits.

The Growth Studio skill is updated to teach the namespaced commands while retaining a compatibility note for old invocations.

## Testing Strategy

The feature follows test-driven development.

### Unit tests

- Configuration isolation and missing-key failures.
- Immutable payload normalization.
- Fresh trace creation and controlled recovery reuse.
- Platform envelope parsing and numeric status mapping.
- Recursive redaction.
- Operation-specific validation.
- Retry classification.
- Atomic artifact writing.
- Command parsing and compatibility alias mapping.
- Webhook signature verification.

### Contract tests

Every entry in the Platform operation catalog has fixture-backed tests for its request method, path, headers, body mode, success envelope, and representative failure envelope. Growth Studio contracts retain their existing tests.

### CLI integration tests

A local mock HTTP server exercises both namespaces end to end, including multipart uploads, submit-and-poll flows, `Retry-After`, timeout recovery, moderation failure, generation failure, and machine-readable output.

### End-to-end tests

Offline E2E tests cover:

- Platform image upload to image-to-video submission to successful polling.
- Platform specialized operation submission and recovery from a saved job.
- Platform webhook verification and rejection.
- Growth Studio namespaced creation and polling.
- Legacy Growth Studio alias delegation.

Authenticated smoke tests are opt-in and limited to explicitly selected read-only account or status endpoints. Default tests never create a paid job.

The suite enforces at least 80% line and branch coverage. A catalog-completeness test fails when an operation lacks a command mapping, validation policy, help entry, contract fixture, or skill reference.

## Verification and Release Gates

A release is acceptable only when:

- unit, contract, integration, and offline E2E tests pass;
- line and branch coverage are at least 80%;
- syntax and type checks pass;
- dependency audit and secret scan pass;
- CLI help snapshots cover both namespaces;
- all documented Platform operations appear in the checked catalog and skill reference;
- no paid job was submitted during automated verification;
- a code-quality review finds no unresolved critical or high-severity issues;
- a security review verifies credential isolation, redaction, input validation, webhook verification, and retry safety;
- the Git diff contains no unrelated pitch, generated-media, or job-artifact changes.

## Official Sources

- PixVerse Platform documentation: <https://docs.platform.pixverse.ai/>
- Platform API consolidated navigation and behavior: <https://docs.platform.pixverse.ai/pixverse-api-llm-txt-2109771m0>
- Platform management site: <https://platform.pixverse.ai/>
