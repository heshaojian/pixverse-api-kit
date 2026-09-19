---
name: pixverse-platform-api
description: Use this skill for PixVerse Platform API commands, payload validation, uploads, generation, polling, webhooks, and recovery through pixverse-api platform.
---

# PixVerse Platform API

Use `pixverse-api platform ...` for the Platform API at `https://app-api.pixverse.ai`.

Configuration:

```bash
PIXVERSE_PLATFORM_API_KEY=...
PIXVERSE_PLATFORM_BASE_URL=https://app-api.pixverse.ai
```

Do not reuse Growth Studio keys. Platform uses `API-KEY` plus a fresh `Ai-trace-id` per new request.

Common commands:

```bash
npm run cli -- platform account balance
npm run cli -- platform upload image ./reference.png
npm run cli -- platform video text --payload ./text-video.json --dry-run
npm run cli -- platform run-job --operation video.image --payload ./image-video.json --poll
npm run cli -- platform resume ./pixverse-api-jobs/platform/<job-dir>
```

Durable job rules:

- Use `run-job` or canonical billable commands for billable catalog operations.
- The CLI writes `request.json` before the billable submission and never automatically retries ambiguous billable POSTs.
- `request.json` keeps the submitted trace ID. `video-id.json` or `image-id.json` keeps known result IDs as strings.
- `polling.jsonl` records status snapshots. `final.json` preserves the original billable submission `trace_id`; `status_trace_id` records the last status request trace.
- If no result ID was saved after an ambiguous response, `resume` returns `reconciliation_required` without issuing another generation.

Webhook rules:

- Verify before parsing JSON.
- Signed string: `${timestamp}\n${nonce}\n${encodeURIComponent(rawBody)}`.
- Signature: Base64 HMAC-SHA256 with the webhook secret.
- Reject stale timestamps, duplicate nonces, malformed signatures, and malformed payloads.
- Return plain `ok` only after verification and successful delivery handling.

Raw command restrictions:

- `platform raw` is for diagnosis only and is not counted as endpoint coverage.
- It requires a relative `/openapi/v2/` path.
- It rejects auth, cookie, host, trace, traversal, backslash, control-character, and URL-escape overrides.

Operation markers covered by this skill:

- operation:account.balance
- operation:account.usage
- operation:upload.image
- operation:upload.media
- operation:resource.templates
- operation:resource.tts-speakers
- operation:resource.restyle-effects
- operation:voice.create
- operation:voice.delete
- operation:image.template
- operation:image.status
- operation:video.text
- operation:video.image
- operation:video.template
- operation:video.transition
- operation:video.multi-transition
- operation:video.lip-sync
- operation:video.fusion
- operation:video.restyle
- operation:video.swap-mask
- operation:video.swap
- operation:video.sound-effect
- operation:video.extend
- operation:video.motion-control
- operation:video.modify
- operation:video.upscale
- operation:video.avatar
- operation:agent.viral-recreation
- operation:agent.real-estate
- operation:video.status

See `references/operation-catalog.md` for command, method, path, billing, and documentation links.
