---
name: pixverse-growth-studio-api
description: Use this skill whenever a user or agent needs to create, upload assets for, poll, list, edit, resume, or finish PixVerse Growth Studio / Marketing Hub OpenAPI video generation jobs. Prefer this skill over browser automation for Growth Studio API work, especially when the user asks Codex or another agent to finish video generation jobs, manage product-video jobs, retrieve output URLs, or integrate with `growth-api.pixverse.ai`.
---

# PixVerse Growth Studio API

Use the local CLI in this repository to interact with the Growth Studio OpenAPI from a server-side context. This keeps API keys out of browsers and gives every job durable files that another agent can inspect or resume.

## Location

Run commands from:

```bash
/Users/john/Documents/ChatGPT/PixVerse Growth Studio
```

Use:

```bash
npm run cli -- <command>
```

The CLI reads `.env` from this directory. It expects:

```bash
PIXVERSE_GROWTH_API_KEY=mh_live_...
PIXVERSE_GROWTH_BASE_URL=https://growth-api.pixverse.ai
```

## Safety Model

The Growth Studio API can create billable video tasks, and the OpenAPI guide says create/edit endpoints do not currently support caller-provided idempotency keys. This shapes the workflow:

- Keep the API key only in `.env` or the server environment.
- Do not print, paste, commit, or store the API key in job artifacts.
- Preserve `video_id` as a string. Do not convert it to a JavaScript number.
- After a timeout or unclear create/edit result, do not resubmit automatically.
- First inspect existing job artifacts, list recent videos, or query known `video_id` values to avoid duplicate charged work.
- Poll details and respect `Retry-After` instead of tight loops.

## Common Commands

List system avatars:

```bash
npm run cli -- avatars
```

Upload an image and get a reusable PixVerse media URL:

```bash
npm run cli -- upload-image /absolute/path/product.webp
```

Create from an e-commerce product page:

```bash
npm run cli -- create-from-url "https://shop.example.com/products/item"
```

Create from a full JSON payload:

```bash
npm run cli -- create-from-json /absolute/path/payload.json
```

Run a full job with durable artifacts:

```bash
npm run cli -- run-job --payload /absolute/path/payload.json --jobs-dir jobs --job-name product-name
```

Resume by polling a known video:

```bash
npm run cli -- poll 627410861853514292
```

Get details:

```bash
npm run cli -- get 627410861853514292
```

List videos:

```bash
npm run cli -- list --limit 20 --status succeeded
```

Edit one clip after confirming the video supports editing:

```bash
npm run cli -- edit 627410861853514292 2 "Make the expression more natural."
```

## Standard Agent Workflow

1. Check whether `.env` exists and has `PIXVERSE_GROWTH_API_KEY`; do not display the value.
2. Prepare a JSON payload in a local working folder. Use a product `source_url`, or upload images first and use only the returned `https://media.pixverse.ai/...` URLs.
3. Prefer `run-job` for new jobs because it saves durable artifacts.
4. Save or report the returned `job_dir`, `video_id`, `status`, `video_url`, and `thumbnail_url`.
5. If polling times out, keep the `job_dir` and `video_id`; another agent can resume with `npm run cli -- poll <video_id>` or inspect `jobs/<job>/`.
6. Before submitting an edit, call `get` and verify `supports_edit: true` and an editable clip index. Editing is also asynchronous.

## Payload Template

Use `references/product-url-payload.json` as the minimal product URL template. Copy it to a job-specific path before editing.

For manually provided product images:

1. Run `upload-image` for each local file.
2. Put returned URLs under `product.images[].url`.
3. Do not use arbitrary merchant image URLs in `product.images`.

## Job Artifacts

`run-job` writes a timestamped folder under `jobs/` unless another `--jobs-dir` is supplied.

- `request.json`: trace ID and submitted payload.
- `create-response.json`: create endpoint response.
- `video-id.json`: string `video_id`.
- `polling.jsonl`: one details snapshot per poll.
- `final.json`: terminal state, or create response when `--no-poll` is used.

Use these artifacts as the source of truth before retrying any creation or edit action.

## Troubleshooting

- Missing key: add `PIXVERSE_GROWTH_API_KEY=mh_live_...` to `.env`.
- `WORKSPACE_ACCESS_DENIED`: the key's user may lack workspace access or may have been removed.
- `INVALID_REQUEST` for images: upload the image through `POST /openapi/v1/image/upload` using `upload-image`; do not paste external image URLs.
- `429`: wait according to `Retry-After`.
- `failed` or `canceled` video status is a resource state, not necessarily a failed details request. Report the resource `error` object and `request_id`.

