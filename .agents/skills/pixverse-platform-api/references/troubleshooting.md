# Troubleshooting

HTTP success is not Platform success. Require a valid response envelope and `ErrCode` equal to zero.

| Class | Evidence | Next action |
|---|---|---|
| Configuration/authentication | Missing `PIXVERSE_PLATFORM_API_KEY`, rejected key, wrong base URL | Stop; fix Platform configuration. Never substitute a Growth Studio or web credential. |
| Local input/media validation | CLI rejects field combinations, URL, type, size, dimensions, duration, or unsafe numeric ID | Fix the payload and rerun `--dry-run`; no provider request was made. |
| Provider parameter rejection | Nonzero parameter-related `ErrCode` | Compare the specialized example, local validator, and current endpoint page; change only the rejected input. |
| Moderation | Status 7 or moderation `ErrCode` | Treat as terminal. Report the provider reason; revise content only if the user asks. Do not hide or bypass moderation. |
| Rate/concurrency pressure | Rate/concurrency `ErrCode`, HTTP 429, or retry guidance | For read-only calls, wait as directed and retry safely. For a confirmed-not-accepted submission, follow provider guidance; if acceptance is ambiguous, reconcile instead of resubmitting. |
| Polling issue | Transient failure while a result ID is known | Preserve the ID and job directory; resume polling without recreating the generation. |
| Ambiguous billable submission | Timeout/connection loss after dispatch and no saved result ID | Do not retry or resubmit. Keep `request.json` and trace ID, inspect usage/provider records, and report `reconciliation_required`. |
| Terminal generation failure | Status 6, 7, or 8 | Preserve final status, trace, provider envelope, and failure details; do not automatically create a replacement job. |
| Missing result ID | Successful-looking create envelope lacks the cataloged ID path | Preserve create response and trace; stop as a response-contract error and reconcile. |
| Trace reuse | New request attempts caller-supplied/saved trace | Create a fresh request trace. Reuse saved trace only via the explicit recovery path. |

Read-only retry safety does not authorize a billable retry. Never resubmit an ambiguous billable request merely because a read-only status or catalog call would be safe to retry.

Before sharing diagnostics, redact credentials, authorization headers, cookies, private media, signed URLs, webhook secrets, and sensitive raw response fields. Preserve safe operation, error, result ID, and trace context for reconciliation.

## Official sources

- [Error codes](https://docs.platform.pixverse.ai/error-codes-796041m0)
- [Common errors and solutions](https://docs.platform.pixverse.ai/common-errors-and-solutions-882978m0)
