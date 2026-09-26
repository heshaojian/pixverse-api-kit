# Platform Default-Wait CLI Design

**Date:** 2026-09-26

**Status:** Approved direction; implementation pending

## Objective

Align `pixverse-api platform` job behavior with the existing PixVerse CLI: billable generation commands wait for a terminal result by default, while callers that need asynchronous execution can explicitly select `--no-wait` and retain the durable job directory for later recovery.

This change affects CLI orchestration only. It does not add a webhook server, change Platform API endpoints, resubmit existing jobs, or alter read-only commands.

## Command Contract

All specialized billable Platform commands wait by default:

```bash
pixverse-api platform video text --payload request.json
```

The generic durable job command follows the same rule:

```bash
pixverse-api platform run-job --operation video.text --payload request.json
```

Callers opt out explicitly:

```bash
pixverse-api platform video text --payload request.json --no-wait
pixverse-api platform run-job --operation video.text --payload request.json --no-wait
```

`--poll` remains accepted as an explicit-wait compatibility alias. Supplying `--poll` together with `--no-wait` is invalid because the requested behaviors conflict.

Read-only Platform commands continue returning immediately. Existing `platform resume <job-directory>` behavior remains unchanged.

## Execution Flow

For a default-wait or explicit `--poll` request:

1. Validate the payload before network submission.
2. Create the durable job directory and persist the request receipt.
3. Submit exactly once and save the returned result ID before polling.
4. Poll the known result ID until a terminal status or timeout.
5. Persist polling history and the final or timeout artifact.
6. Return one structured final result to the caller.

For `--no-wait`, steps 1–3 are identical, then the CLI returns the accepted job record immediately. It must not start background polling after the process exits.

## Output And Recovery

- JSON mode keeps stdout machine-readable and emits only the command result.
- Interactive progress remains outside JSON stdout.
- A successful terminal response includes the saved job directory and provider result.
- A timeout is recoverable and must identify the same job directory and result ID.
- `platform resume` continues the saved job without creating or billing a replacement request.
- Provider failure and moderation terminal states remain terminal and are preserved in durable artifacts.

## Option Parsing

- Specialized billable commands accept `--no-wait`, `--poll`, `--interval-ms`, and `--timeout-ms`.
- `run-job` accepts the same wait controls.
- Read-only specialized commands reject wait-only flags rather than silently ignoring them.
- Timeout and interval values retain the current numeric validation and bounds.
- A caller-supplied trace ID remains forbidden for new jobs.

## Documentation

Update the root README, CLI help, Platform skill, and workflow examples so the primary path demonstrates default waiting. Document `--no-wait` as the asynchronous option and `resume` as the recovery path. Do not present webhooks as required for local CLI usage.

## Testing

Use test-first changes covering:

- Specialized billable commands pass `poll: true` by default.
- `run-job` passes `poll: true` by default.
- `--no-wait` passes `poll: false` and returns the accepted durable job.
- Explicit `--poll` remains valid.
- Combining `--poll` and `--no-wait` fails before submission.
- Wait timing options reach the job runner for both command surfaces.
- Read-only commands reject wait-only flags.
- Timeout artifacts remain resumable without resubmission.
- Help text, README examples, and Platform skill guidance reflect the new contract.

The full API test suite, coverage threshold, syntax checks, security scan, and package audit must pass before completion.

## Acceptance Criteria

1. A billable specialized Platform command waits by default.
2. `platform run-job` waits by default.
3. `--no-wait` returns immediately after one accepted submission and preserves recovery artifacts.
4. `--poll` remains a non-conflicting compatibility alias.
5. Timeout recovery uses `resume` and never resubmits generation.
6. JSON output remains suitable for agents and scripts.
7. Documentation and tests describe the same behavior as the implementation.
