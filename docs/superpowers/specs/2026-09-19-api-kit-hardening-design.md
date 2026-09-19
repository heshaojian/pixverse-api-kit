# PixVerse API Kit Hardening Design

**Date:** 2026-09-19

**Status:** Approved design

## Objective

Make `pixverse-api-kit` trustworthy as the unified server API CLI for both PixVerse Platform and Growth Studio. Preserve the provider-first command model and credential separation while closing validation, recovery, security, test-isolation, and documentation gaps found in the whole-repository review.

## Architecture

The public hierarchy remains:

```text
pixverse-api
├── platform
└── growth-studio
```

The separate web-product CLI remains `pixverse`. Platform and Growth Studio keep independent credentials, base URLs, billing, payloads, and artifacts. Shared infrastructure may implement common safety behavior, but it must not blur provider boundaries.

## Changes

### Platform validation contract

- Require `template_id` for template video generation.
- Require `prompt` for video sound-effect generation.
- Enforce the documented maximum of three `mask_urls` for video swap.
- Add mutation-style tests that remove or corrupt distinguishing fields from otherwise valid fixtures so operation-specific validation cannot silently regress.

### Growth Studio durable execution

- Validate polling and timeout values as finite, non-negative or positive values as appropriate.
- Treat malformed successful JSON as a protocol error, not an empty successful response.
- Write request, response, identifier, final, and error artifacts atomically through shared artifact helpers.
- Redact secrets and sensitive headers before persistence.
- Add `growth-studio resume <job-dir>`. A known saved video ID may be polled; a directory without a known ID must stop at `reconciliation_required` and must never resubmit the billable request.
- Keep existing command and response compatibility where it does not conflict with safety.

### Credential destination policy

- Default Platform and Growth Studio credentials may only be sent to their official HTTPS origins.
- Loopback HTTP/HTTPS remains allowed for local tests and development.
- Any other origin requires an explicit provider-specific custom-base-URL opt-in.
- Dotenv loading is allowlisted to documented provider configuration keys.

### Hermetic quality gates

- `npm test` becomes the clean-clone, no-paid-network API suite.
- Customer-pitch and brand-asset tests move behind an explicit `test:pitches` command because their ignored media fixtures are not part of a fresh clone.
- CI installs from the lockfile and runs checks, tests with coverage, secret scanning, and dependency audit without credentials.

### Repository-wide secret scanning

- Scan tracked text files rather than a hand-maintained directory subset.
- Skip binary content and dependency/build output while retaining generated-but-tracked deployment, payload, job-metadata, documentation, and workflow surfaces.
- Test the tracked-file discovery and detection behavior without exposing real secrets.

### Documentation and onboarding

- Document local installation/linking honestly while the package remains private.
- Expand the command reference to cover both providers, durable execution, recovery, safety flags, and diagnostics.
- Correct webhook canonicalization documentation to match the verified implementation.
- Update the Growth Studio skill to name the unified checkout and its provider boundary.

## Error and recovery invariants

1. A billable submission happens at most once per `run-job` invocation.
2. Automatic retries are limited to safe read-only requests.
3. Ambiguous submission without a saved result ID ends in `reconciliation_required`.
4. Resume never creates a new billable request.
5. Artifact writes are atomic and secret-redacted.
6. HTTP success is insufficient when a provider envelope or response body is malformed.

## Verification

- Focused tests are written before each implementation change.
- API coverage remains at least 80% and no-paid-network guards stay active.
- A temporary clean clone must pass the default test command without ignored assets.
- The full local optional pitch suite is reported separately.
- Static checks, secret scan, dependency audit, and diff checks must pass.

## Non-goals

- Publishing the private npm package.
- Merging the web `pixverse` CLI into this repository.
- Combining Platform and Growth Studio accounts, credentials, or credits.
- Splitting brand-pitch assets into a separate repository in this change.
- Adding undocumented remote API endpoints.
