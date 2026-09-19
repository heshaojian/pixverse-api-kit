---
name: pixverse-growth-studio-api
description: Use this skill whenever a user or agent needs to create, upload assets for, poll, list, edit, resume, or finish PixVerse Growth Studio / Marketing Hub OpenAPI video generation jobs. Prefer this skill over browser automation for Growth Studio API work, especially when the user asks Codex or another agent to finish video generation jobs, manage product-video jobs, retrieve output URLs, or integrate with `growth-api.pixverse.ai`.
---

# PixVerse API Kit: Growth Studio API

Use the local `pixverse-api growth-studio ...` CLI in this repository to interact with the Growth Studio OpenAPI from a server-side context. This keeps API keys out of browsers and gives every job durable files that another agent can inspect or resume.

This repository is `pixverse-api-kit`. It contains the Growth Studio API client, tests, agent skill instructions, and public-safe brand pitch pages under `deploy/brand-pitches/<brand>/<pitch-name>/`.

In this workspace, use this Growth Studio API CLI for Growth Studio/product-video jobs. Do not switch to the general PixVerse CLI as a workaround unless John explicitly asks for that tool in the current turn.

## Location

Run commands from the repository root. When working locally for John, first confirm you are in the active `PixVerse Growth Studio` checkout.

```bash
npm run cli -- <command>
```

The CLI reads `.env` from this directory. It expects:

```bash
PIXVERSE_GROWTH_API_KEY=mh_live_...
PIXVERSE_GROWTH_BASE_URL=https://growth-api.pixverse.ai
# Optional, only when Growth Studio folder list/create uses a different API prefix/token:
PIXVERSE_GROWTH_FOLDER_API_PREFIX=/marketing_hub
PIXVERSE_GROWTH_FOLDER_API_KEY=...
```

## Safety Model

The Growth Studio API can create billable video tasks, and the OpenAPI guide says create/edit endpoints do not currently support caller-provided idempotency keys. This shapes the workflow:

- Keep the API key only in `.env` or the server environment.
- Treat folder list/create and `folder_id` assignment as Growth Studio API work. If the backend exposes a different folder path prefix, set `PIXVERSE_GROWTH_FOLDER_API_PREFIX` instead of using browser automation.
- If folder list/create rejects the video-generation key, set `PIXVERSE_GROWTH_FOLDER_API_KEY` to the proper Growth Studio folder-management token instead of changing `PIXVERSE_GROWTH_API_KEY`.
- Use `npm run cli -- ...` from this repository as the default execution surface for video jobs in this workspace.
- Do not print, paste, commit, or store the API key in job artifacts.
- Preserve `video_id` as a string. Do not convert it to a JavaScript number.
- Preserve `folder_id` as a string when targeting a Growth Studio folder.
- After a timeout or unclear create/edit result, do not resubmit automatically.
- First inspect existing job artifacts, list recent videos, or query known `video_id` values to avoid duplicate charged work.
- Poll details and respect `Retry-After` instead of tight loops.

## Common Commands

List system avatars:

```bash
npm run cli -- growth-studio avatars list
```

List Growth Studio folders:

```bash
npm run cli -- growth-studio folders list
```

Ensure a customer/topic folder exists:

```bash
npm run cli -- growth-studio folders ensure "REVOLVE"
```

Upload an image and get a reusable PixVerse media URL:

```bash
npm run cli -- growth-studio upload image /absolute/path/product.webp
```

Create from an e-commerce product page:

```bash
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item"
```

Create into a specific Growth Studio folder:

```bash
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item" --folder-id 630251570268735431
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --folder-id 630251570268735431
```

Create into a named customer/topic folder, creating it when missing:

```bash
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item" --folder-name "REVOLVE"
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --folder-name "REVOLVE"
```

Infer the folder from payload metadata, merchant URL, or product brand:

```bash
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --auto-folder
```

Create from a full JSON payload:

```bash
npm run cli -- growth-studio video create-from-json /absolute/path/payload.json
```

Run a full job with durable artifacts:

```bash
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --jobs-dir jobs --job-name product-name
```

Resume by polling a known video:

```bash
npm run cli -- growth-studio video poll 627410861853514292
```

Get details:

```bash
npm run cli -- growth-studio video get 627410861853514292
```

List videos:

```bash
npm run cli -- growth-studio video list --limit 20 --status succeeded
```

Edit one clip after confirming the video supports editing:

```bash
npm run cli -- growth-studio video edit 627410861853514292 2 "Make the expression more natural."
```

## Standard Agent Workflow

1. Check whether `.env` exists and has `PIXVERSE_GROWTH_API_KEY`; do not display the value.
2. Prepare a JSON payload in a local working folder. Use a product `source_url`, or upload images first and use only the returned `https://media.pixverse.ai/...` URLs.
3. Organize generation into a Growth Studio folder before creation:
   - Use `--folder-id <folder_id>` only when a verified folder id is already known.
   - Prefer `--folder-name <customer-or-topic>` for customer/topic pilots; the CLI reuses a case-insensitive matching folder or creates it when missing.
   - Use `--auto-folder` when payload metadata has `folder_name`, `customer`, `customer_name`, `brand`, `topic`, or `campaign`, or when `product.source_url` has a merchant domain such as `revolve.com`.
   - For customer pilots, set `metadata.customer` or `metadata.folder_name` to the customer/account name so similar product jobs land in the same folder.
   - Use `npm run cli -- growth-studio folders ensure "<name>"` when you want to verify/create the folder without starting a video job.
4. Prefer `run-job` for new jobs because it saves durable artifacts, including `folder.json` when folder resolution is used.
5. Save or report the returned `job_dir`, `video_id`, `status`, `video_url`, `thumbnail_url`, and resolved `folder_id`/`folder_name`.
6. If polling times out, keep the `job_dir` and `video_id`; another agent can resume with `npm run cli -- growth-studio video poll <video_id>` or inspect `jobs/<job>/`.
7. Before submitting an edit, call `get` and verify `supports_edit: true` and an editable clip index. Editing is also asynchronous.

## Payload Template

Use `references/product-url-payload.json` as the minimal product URL template. Copy it to a job-specific path before editing.

For V2 folder targeting, put `folder_id` at the root of the create payload:

```json
{
  "folder_id": "630251570268735431",
  "product": { "source_url": "https://shop.example.com/products/item" },
  "video": { "aspect_ratio": "9:16" }
}
```

For agent-created customer/topic jobs, prefer named or inferred folders instead of hardcoding old folder ids:

```bash
npm run cli -- growth-studio run-job --payload /absolute/path/revolve-payload.json --folder-name "REVOLVE"
```

## Legacy Aliases

Legacy `0.x` aliases still work and emit one deprecation warning:

| Legacy | Canonical |
|---|---|
| `avatars` | `growth-studio avatars list` |
| `folders` | `growth-studio folders list` |
| `ensure-folder` | `growth-studio folders ensure` |
| `upload-image` | `growth-studio upload image` |
| `create-from-url` | `growth-studio video create-from-url` |
| `create-from-json` | `growth-studio video create-from-json` |
| `get` | `growth-studio video get` |
| `poll` | `growth-studio video poll` |
| `list` | `growth-studio video list` |
| `edit` | `growth-studio video edit` |
| `run-job` | `growth-studio run-job` |

For manually provided product images:

1. Run `growth-studio upload image` for each local file.
2. Put returned URLs under `product.images[].url`.
3. Do not use arbitrary merchant image URLs in `product.images`.

## Job Artifacts

`run-job` writes a timestamped folder under `jobs/` unless another `--jobs-dir` is supplied.

- `request.json`: trace ID and submitted payload.
- `folder.json`: resolved folder id/name and whether the folder was reused or created, when folder resolution was used.
- `create-response.json`: create endpoint response.
- `video-id.json`: string `video_id`.
- `polling.jsonl`: one details snapshot per poll.
- `final.json`: terminal state, or create response when `--no-poll` is used.

Use these artifacts as the source of truth before retrying any creation or edit action.

## Troubleshooting

- Missing key: add `PIXVERSE_GROWTH_API_KEY=mh_live_...` to `.env`.
- `Token is invalid` from `folders`, `ensure-folder`, `--folder-name`, or `--auto-folder`: the configured Growth Studio folder endpoint is rejecting the current server-side token. Check `PIXVERSE_GROWTH_FOLDER_API_PREFIX` against the current OpenAPI guide, set `PIXVERSE_GROWTH_FOLDER_API_KEY` only if the backend requires a separate token, or use a verified `--folder-id` until backend auth is aligned.
- `WORKSPACE_ACCESS_DENIED`: the key's user may lack workspace access or may have been removed.
- `INVALID_REQUEST` for images: upload the image through `POST /openapi/v1/image/upload` using `growth-studio upload image`; do not paste external image URLs.
- `429`: wait according to `Retry-After`.
- `failed` or `canceled` video status is a resource state, not necessarily a failed details request. Report the resource `error` object and `request_id`.
