# PixVerse API Kit

Agent-safe PixVerse API tools for the Platform API and Growth Studio API. The installed binary is `pixverse-api`; the general PixVerse web CLI remains separate.

## Setup

```bash
cp .env.example .env
```

Put API keys in `.env`:

```bash
PIXVERSE_PLATFORM_API_KEY=...
PIXVERSE_PLATFORM_BASE_URL=https://app-api.pixverse.ai

PIXVERSE_GROWTH_API_KEY=mh_live_...
PIXVERSE_GROWTH_BASE_URL=https://growth-api.pixverse.ai
PIXVERSE_GROWTH_FOLDER_API_PREFIX=/marketing_hub
PIXVERSE_GROWTH_FOLDER_API_KEY=...
```

Keys stay server-side. Platform and Growth Studio credentials are separate and never fall back to each other.

## Provider Commands

```bash
npm run cli -- platform --help
npm run cli -- growth-studio --help
```

Platform examples:

```bash
npm run cli -- platform account balance
npm run cli -- platform upload image /absolute/path/reference.png
npm run cli -- platform video text --payload /absolute/path/text-video.json --dry-run
npm run cli -- platform run-job --operation video.image --payload /absolute/path/image-video.json --poll
npm run cli -- platform resume /absolute/path/pixverse-api-jobs/platform/<job-dir>
```

Growth Studio examples:

```bash
npm run cli -- growth-studio avatars list
npm run cli -- growth-studio folders list
npm run cli -- growth-studio folders ensure "REVOLVE"
npm run cli -- growth-studio upload image /absolute/path/product.webp
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item"
npm run cli -- growth-studio video create-from-json /absolute/path/payload.json
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --folder-name "REVOLVE"
npm run cli -- growth-studio video poll 627410861853514292
```

Legacy Growth Studio aliases such as `get`, `poll`, `run-job`, and `create-from-url` still work during `0.x` and emit one deprecation warning.

## Safety

- Platform uses `API-KEY` and a fresh `Ai-trace-id` for every new request.
- Growth Studio uses `Authorization: Bearer <PIXVERSE_GROWTH_API_KEY>`.
- Keep all IDs as strings.
- Use durable job commands for billable work.
- After an ambiguous billable response, inspect saved artifacts and known IDs before retrying.
- Default automated tests use loopback or injected clients and do not submit paid jobs.

## Docs

- `docs/api/command-reference.md`
- `docs/api/platform-operations.md`
- `docs/api/safety-and-recovery.md`
- `.agents/skills/pixverse-api/SKILL.md`
- `.agents/skills/pixverse-platform-api/SKILL.md`
- `.agents/skills/pixverse-growth-studio-api/SKILL.md`

## Job Artifacts

Platform `run-job` writes under `pixverse-api-jobs/platform/` by default. Growth Studio `run-job` writes under `jobs/` by default. Artifacts preserve request evidence, known IDs, polling snapshots, final state, and safe error records so another agent can recover without duplicate spend.
