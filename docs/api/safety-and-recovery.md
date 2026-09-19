# Safety and Recovery

## Credentials

- Platform: `PIXVERSE_PLATFORM_API_KEY`, header `API-KEY`, Platform credits.
- Growth Studio: `PIXVERSE_GROWTH_API_KEY`, bearer auth, Growth Studio credits.
- The providers never fall back to each other's keys.
- The official HTTPS origins are the defaults. HTTP/HTTPS loopback origins (`localhost`, `127.0.0.1`, or `::1`) are allowed for local testing.
- A non-default, non-loopback origin must use HTTPS and is rejected unless the matching explicit opt-in is `true`: `PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL` or `PIXVERSE_GROWTH_ALLOW_CUSTOM_BASE_URL`. Enabling one permits that provider's credential to be sent to the configured custom origin, so use it only with a server you control.

## Durable Jobs

Use `run-job` to start billable work. The command writes a durable, redacted request artifact before submission. A new Platform job gets a fresh UUID `Ai-trace-id`; recovery may reuse only the saved trace from `request.json`. Growth Studio stores its own trace and never borrows Platform credentials or identifiers.

Depending on the provider and how far the job reached, its directory can contain:

- `request.json`
- `folder.json` when Growth Studio folder resolution was used
- `create-response.json`
- `video-id.json` or `image-id.json`
- `polling.jsonl`
- `final.json`
- `error.json` on failures

Growth Studio JSON artifacts are private, atomic, and recursively redacted. When Growth Studio resumes a nonterminal `final.json`, it preserves the earlier snapshot as `final-prior-N.json` before continuing.

Resume with the matching provider:

```bash
pixverse-api platform resume /absolute/path/pixverse-api-jobs/platform/<job-dir>
pixverse-api growth-studio resume /absolute/path/jobs/<job-dir>
```

`resume` is poll-only. It reads the saved result ID and continues status checks; it never calls a create endpoint. If the submission response was ambiguous and no result ID was saved, it returns `reconciliation_required` instead of risking a duplicate charged generation. Inspect the saved request, error, recent remote jobs, and any provider request ID before deciding whether to submit again.

## Webhooks

Platform webhook verification first parses the raw body as a JSON object whose values must be scalar. It converts those key/value pairs to a URL-encoded query string with `URLSearchParams`, and verifies either insertion order or key-sorted order for compatibility. The signed string is:

```text
${timestamp}\n${nonce}\n${queryString}
```

For example, `{"video_id":"123","status":1}` becomes `video_id=123&status=1`. Nested objects, arrays, and `null` are not supported by this signature format. The signature is Base64 HMAC-SHA256. The handler validates authentication and reserves the nonce before delivery, rejects replays, and returns exact body `ok` only after the delivery callback succeeds and the nonce reservation is committed.
