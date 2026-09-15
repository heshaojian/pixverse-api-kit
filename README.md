# PixVerse API Kit

Agent-safe PixVerse API tools for Growth Studio video generation, reusable customer folders, durable job artifacts, and customer-ready brand pitch assets.

## Repository Layout

```text
src/                         CLI and API client implementation
test/                        Node test coverage for client, jobs, folders, and pitch pages
.agents/skills/              Agent-facing operating instructions
deploy/brand-pitches/        Public-safe customer pitch pages by brand
docs/brand-pitches/          Playbook, specs, and plans for brand pitch work
```

Brand pitch pages use:

```text
deploy/brand-pitches/<brand>/<pitch-name>/
```

Current examples:

- `deploy/brand-pitches/plaud/plaud-pixverse-0914/`
- `deploy/brand-pitches/revolve/v4/`

## Setup

```bash
cp .env.example .env
```

Put the production key in `.env`:

```bash
PIXVERSE_GROWTH_API_KEY=mh_live_...
# Optional, only if Growth Studio folder list/create uses a different API prefix/token:
PIXVERSE_GROWTH_FOLDER_API_PREFIX=/marketing_hub
PIXVERSE_GROWTH_FOLDER_API_KEY=...
```

The key must stay server-side. Do not put it in browser JavaScript, client apps, logs, or public repositories.

## Commands

List system avatars:

```bash
npm run cli -- avatars
```

List Growth Studio folders:

```bash
npm run cli -- folders
```

Ensure a customer/topic folder exists:

```bash
npm run cli -- ensure-folder "REVOLVE"
```

Upload an image:

```bash
npm run cli -- upload-image /absolute/path/product.webp
```

Create a video from a product URL:

```bash
npm run cli -- create-from-url https://shop.example.com/products/running-shoes
```

Create into a specific Growth Studio folder:

```bash
npm run cli -- create-from-url https://shop.example.com/products/running-shoes --folder-id 630251570268735431
```

Create into a customer/topic folder by name, creating it first when it does not exist:

```bash
npm run cli -- create-from-url https://shop.example.com/products/running-shoes --folder-name "REVOLVE"
```

Let the agent kit infer the folder from payload metadata, merchant URL, or brand:

```bash
npm run cli -- run-job --payload /absolute/path/payload.json --auto-folder
```

Create a video from a full JSON payload:

```bash
npm run cli -- create-from-json /absolute/path/payload.json
```

Run an end-to-end job and save durable artifacts:

```bash
npm run cli -- run-job --payload /absolute/path/payload.json --jobs-dir jobs --job-name running-shoes
```

`run-job` also accepts `--folder-id <folder_id>`, `--folder-name <name>`, or `--auto-folder`. When a folder is resolved, it writes `folder.json` plus the final submitted payload into `request.json`.

Get video details:

```bash
npm run cli -- get 627410861853514292
```

Poll until complete:

```bash
npm run cli -- poll 627410861853514292
```

List videos:

```bash
npm run cli -- list --limit 20 --status succeeded
```

Edit a clip:

```bash
npm run cli -- edit 627410861853514292 2 "Make the expression more natural."
```

## API Notes

- Base URL: `https://growth-api.pixverse.ai`
- Base path: `/openapi/v1`
- Auth: `Authorization: Bearer <API_KEY>`
- Folder assignment is part of Growth Studio creation: send root-level `folder_id` in `POST /openapi/v1/videos`.
- Folder list/create is also treated as Growth Studio API work. The CLI uses `PIXVERSE_GROWTH_FOLDER_API_PREFIX` when provided, otherwise it defaults to `/marketing_hub`; it uses `PIXVERSE_GROWTH_FOLDER_API_KEY` when provided, otherwise it uses `PIXVERSE_GROWTH_API_KEY`.
- V2 create payloads can include root-level `folder_id` to place the generated video in a Growth Studio folder. Keep it as a string, just like `video_id`.
- Folder organization can be resolved before creation. `--folder-id` wins; otherwise `--folder-name` reuses a case-insensitive matching folder or creates one; `--auto-folder` infers the folder from `metadata.folder_name`, `metadata.customer`, merchant domain, `product.brand`, or topic/campaign metadata.
- The create and edit endpoints do not support caller-provided idempotency keys.
- If create or edit times out, do not blindly retry. Check saved business records or video details first to avoid duplicate charged tasks.
- Keep `video_id` as a string. It is a 64-bit ID and must not be converted to a JavaScript number.

## Brand Pitch Pages

Customer-facing static pitch pages live under `deploy/brand-pitches/`. Keep each pitch folder self-contained with its `index.html`, `_headers`, and public-safe local assets.

Do not put private research, API keys, raw generation payloads, internal job IDs, or non-public notes in the deploy surface. Keep pitch methodology and working docs under `docs/brand-pitches/`.

## Job Artifacts

`run-job` writes one timestamped folder under `jobs/` by default:

- `request.json`: trace ID and create payload.
- `folder.json`: resolved folder id/name and whether it was created, when folder resolution was used.
- `create-response.json`: response from `POST /openapi/v1/videos`.
- `video-id.json`: saved string `video_id`.
- `polling.jsonl`: one details snapshot per poll, when polling is enabled.
- `final.json`: terminal resource state, or the create response when `--no-poll` is used.
