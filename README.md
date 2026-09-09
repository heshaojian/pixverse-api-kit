# PixVerse Growth Studio Agent Kit

Agent-safe skill and server-side CLI for the PixVerse Growth Studio OpenAPI.

## Setup

```bash
cp .env.example .env
```

Put the production key in `.env`:

```bash
PIXVERSE_GROWTH_API_KEY=mh_live_...
```

The key must stay server-side. Do not put it in browser JavaScript, client apps, logs, or public repositories.

## Commands

List system avatars:

```bash
npm run cli -- avatars
```

Upload an image:

```bash
npm run cli -- upload-image /absolute/path/product.webp
```

Create a video from a product URL:

```bash
npm run cli -- create-from-url https://shop.example.com/products/running-shoes
```

Create a video from a full JSON payload:

```bash
npm run cli -- create-from-json /absolute/path/payload.json
```

Run an end-to-end job and save durable artifacts:

```bash
npm run cli -- run-job --payload /absolute/path/payload.json --jobs-dir jobs --job-name running-shoes
```

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
- The create and edit endpoints do not support caller-provided idempotency keys.
- If create or edit times out, do not blindly retry. Check saved business records or video details first to avoid duplicate charged tasks.
- Keep `video_id` as a string. It is a 64-bit ID and must not be converted to a JavaScript number.

## Job Artifacts

`run-job` writes one timestamped folder under `jobs/` by default:

- `request.json`: trace ID and create payload.
- `create-response.json`: response from `POST /openapi/v1/videos`.
- `video-id.json`: saved string `video_id`.
- `polling.jsonl`: one details snapshot per poll, when polling is enabled.
- `final.json`: terminal resource state, or the create response when `--no-poll` is used.
