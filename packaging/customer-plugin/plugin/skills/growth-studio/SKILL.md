---
name: growth-studio
description: Use PixVerse Growth Studio API for PDP product videos, uploads, wallet reads, product-page workflows, polling, and durable recovery.
---

# PixVerse Growth Studio API

Resolve the installed plugin root from this `SKILL.md` location and execute `<plugin-root>/scripts/pixverse-api growth-studio ...`. Use only `PIXVERSE_GROWTH_API_KEY`; never use Platform or web-product credentials.

If credentials are missing, route setup to `pixverse-api auth login growth-studio --stdin` or the packaged `Configure PixVerse API Credentials.command`. Do not ask the user to paste the key into chat.

## PDP workflow

1. Prepare a product with a title and one to eight uploaded `https://media.pixverse.ai/...` image URLs.
2. Copy `<plugin-root>/examples/pdp-standard-high.json` to a job-specific location and replace only its neutral example values.
3. Run `growth-studio pdp create --payload <absolute-path> --dry-run`. Dry run uses no credentials, creates no job, and sends no request.
4. Optionally run `growth-studio wallet balance` as a read-only snapshot. It is not a price quote or spending approval.
5. Obtain explicit approval immediately before one `--confirm-billable` create.
6. Preserve the returned `job_dir`, `video_id`, and `ledger_source_id`, then poll or resume that job.

The current PDP request requires `product`. `video` may be omitted, `null`, or an object. An object requires `mode` set to `standard` or `pro`; `quality` may be `normal` or `high`. Omitted and null video configuration use provider defaults and are omitted from the wire request.

PDP submits exactly once to `POST /openapi/v1/ecommerce_pdp/video`, with only `product` and the optional `video` object in the request body. There is no fallback create route and no completion callback. Wait five seconds before the first status read, then poll the returned video resource and honor `Retry-After` while it remains queued or processing.

## Recovery

A successful create acceptance means queued and charged, not completed. Never retry a create automatically after a timeout, connection loss, malformed response, or interrupted poll. If a saved video ID exists, use `pdp resume <job-dir>`. If no ID was saved, retain the redacted evidence and stop at reconciliation.

Use `<plugin-root>/docs/api/growth-studio-pdp.md` and `<plugin-root>/docs/api/safety-and-recovery.md` for exact fields, artifacts, errors, and recovery rules.
