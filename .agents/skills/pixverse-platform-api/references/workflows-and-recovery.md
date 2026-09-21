# Workflows and Recovery

## Read-only discovery

1. Use `platform account balance` when remaining credits affect the decision.
2. Query templates, speakers, or restyle effects live rather than relying on a saved list.
3. Preserve returned IDs as strings in every payload and artifact.

For example, `npm run cli -- platform resource templates --payload ./template-query.json` performs current catalog discovery without spending generation credits.

## Upload, preflight, submit, poll

1. Upload the required image/media and preserve its returned string ID.
2. Save the specialized operation input to a JSON file.
3. Run `npm run cli -- platform <group> <action> --payload <file> --dry-run`.
4. Resolve validation errors before any live call.
5. Confirm the exact billable operation is authorized now; check balance/expected impact when material.
6. Run `npm run cli -- platform run-job --operation <operation-id> --payload <file> --poll` once.
7. Preserve `request.json`, create response, ID artifact, `polling.jsonl`, and `final.json` from the returned job directory.

A typical specialized preflight is `npm run cli -- platform video image --payload ./image-video.json --dry-run`. After exact spend authorization, submit that same validated input once with `npm run cli -- platform run-job --operation video.image --payload ./image-video.json --poll`.

### Music MV

1. Upload audio with `platform upload media` and retain the returned `media_id` string.
2. Call `platform audio verify --payload ./audio-verification.json`; do not continue if review fails.
3. Optionally upload one character image and/or one style image.
4. Run `platform agent music-mv --payload ./music-mv.json --dry-run` and resolve local validation errors.
5. Check balance and confirm the exact paid request.
6. Submit once with `platform run-job --operation agent.music-mv --payload ./music-mv.json --poll`.
7. Poll the returned video ID or use `resume`; never repeat generation to recover status.

`image_references` is accepted as a documented input alias and normalized to `img_references`. Do not send both fields. Lip sync requires recognizable vocals; audio verification does not authorize an automatic paid submission.

### Durable artifact meanings

- `request.json` is written before submission and records the provider, operation, redacted headers, original submission trace, and normalized input.
- `create-response.json` preserves the redacted create response.
- `video-id.json` or `image-id.json` preserves the known result ID as a string.
- `polling.jsonl` appends each redacted status snapshot and status-request trace.
- `final.json` preserves the original submission `trace_id`; `status_trace_id` identifies the latest status request.
- `error.json` preserves safe failure classification and trace context without exposing secrets.

## Resume

- Run `npm run cli -- platform resume <job-directory>` to continue polling a saved image/video ID.
- Resume never reissues generation. If the create outcome was ambiguous and no result ID exists, it returns `reconciliation_required`; stop and reconcile provider/account records instead of submitting again.
- A terminal `final.json` is returned without another provider call. A timed-out job with a known ID can resume polling safely.

## Platform statuses

| Code | Normalized status | Terminal |
|---|---|---|
| 1 | `succeeded` | yes |
| 5 | `processing` | no |
| 6 | `deleted` | yes |
| 7 | `moderation_failed` | yes |
| 8 | `failed` | yes |

Poll a known ID at the documented cadence and honor provider retry guidance. Preserve the original submission trace separately from status-request traces.

## Webhooks

Use the [official webhook page](https://docs.platform.pixverse.ai/how-to-use-webhook-1905378m0) to confirm current supported operations and delivery behavior. Verify timestamp, nonce, Base64 HMAC-SHA256 signature, time window, and nonce replay state before parsing JSON or invoking delivery logic. Return plain `ok` only after verified successful handling; use HTTPS and idempotent delivery processing.

## Raw diagnostics

Use `platform raw` only for a relative `/openapi/v2/` path when diagnosing a documented endpoint or inspecting a newly published endpoint not yet in the catalog. Start with `--dry-run`. Never pass API keys, cookies, host, content length, authorization, or trace headers; the CLI owns those headers and assigns a fresh trace.

For example, dry-run a read-only diagnostic with `npm run cli -- platform raw GET /openapi/v2/account/balance --dry-run`. Any URL placed in a diagnostic payload must use a public, task-scoped source such as `https://cdn.example.test/reference.png`; never copy private media into committed artifacts.
