# Safety and Recovery

## Credentials

- Platform: `PIXVERSE_PLATFORM_API_KEY`, header `API-KEY`, Platform credits.
- Growth Studio: `PIXVERSE_GROWTH_API_KEY`, bearer auth, Growth Studio credits.
- The providers never fall back to each other's keys.

## Platform Jobs

Billable Platform submissions write a durable request artifact before the request is sent. A new billable request gets a fresh UUID `Ai-trace-id`; recovery may reuse only the saved trace from `request.json`.

Artifacts:

- `request.json`
- `create-response.json`
- `video-id.json` or `image-id.json`
- `polling.jsonl`
- `final.json`
- `error.json` on failures

If a response is ambiguous and no result ID was saved, `resume` returns `reconciliation_required` and does not submit a second generation.

## Webhooks

Platform webhook verification uses the official signed string:

```text
${timestamp}\n${nonce}\n${encodeURIComponent(rawBody)}
```

The signature is Base64 HMAC-SHA256. The handler verifies before JSON parsing, rejects replayed nonces, and returns exact body `ok` only after delivery succeeds.
