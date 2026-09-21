# PixVerse API Kit

Agent-safe PixVerse API tools for the Platform API and Growth Studio API. The installed binary is `pixverse-api`; the general PixVerse web CLI remains separate.

## Local Setup

This package is private and is not published to npm. Install its pinned dependencies from this checkout, then link the `pixverse-api` binary locally:

```bash
npm ci
npm link
pixverse-api --help
```

If you do not want a global npm link, replace `pixverse-api` in the examples with `npm run cli --`.

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

The default origins are the official HTTPS services. HTTP/HTTPS loopback origins (`localhost`, `127.0.0.1`, or `::1`) are allowed for local tests. Any other origin must use HTTPS and is rejected unless its provider-specific opt-in is set to `true`:

```bash
PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL=true
PIXVERSE_GROWTH_ALLOW_CUSTOM_BASE_URL=true
```

Those flags deliberately allow credentials to be sent to the configured custom origin. Use them only for a server you control and keep them out of normal production configuration.

## Provider Commands

```bash
npm run cli -- platform --help
npm run cli -- growth-studio --help
```

Platform examples:

```bash
npm run cli -- platform account balance
npm run cli -- platform resource templates --payload /absolute/path/template-query.json
npm run cli -- platform upload image /absolute/path/reference.png
npm run cli -- platform video text --payload /absolute/path/text-video.json --dry-run
npm run cli -- platform run-job --operation video.image --payload /absolute/path/image-video.json --poll
npm run cli -- platform resume /absolute/path/pixverse-api-jobs/platform/<job-dir>
```

### Platform API Capabilities

The Platform provider covers every specialized endpoint currently documented by PixVerse. Discovery and status operations are read-only; uploads and custom-voice management are non-billable; generation, editing, enhancement, and agent operations are billable.

| Area | Operations | What it covers |
|---|---|---|
| Account | `account.balance`, `account.usage` | Current Platform credits and usage deductions or refunds |
| Uploads | `upload.image`, `upload.media` | Images plus video or audio inputs for later operations |
| Audio review | `audio.verify` | Synchronous review of uploaded audio before Music MV generation |
| Live resources | `resource.templates`, `resource.tts-speakers`, `resource.restyle-effects` | Current effect templates, speech voices, and restyle presets |
| Custom voices | `voice.create`, `voice.delete` | Create and remove custom TTS voices |
| Images | `image.template`, `image.status` | Template-based image generation and result polling |
| Core video generation | `video.text`, `video.image`, `video.template` | Text-to-video, image-to-video, and managed template effects |
| Guided video generation | `video.transition`, `video.multi-transition`, `video.fusion`, `video.motion-control` | First/last-frame transitions, ordered keyframes, references, and motion transfer |
| Speech and sound | `video.lip-sync`, `video.avatar`, `video.sound-effect` | Lip sync, talking portraits, and synchronized generated audio |
| Video editing | `video.restyle`, `video.swap-mask`, `video.swap`, `video.modify` | Style transfer, subject or region replacement, and prompt-directed edits |
| Video finishing | `video.extend`, `video.upscale` | Clip continuation and resolution enhancement |
| Specialized agents | `agent.viral-recreation`, `agent.real-estate`, `agent.music-mv` | Viral recreation, real-estate video, and one-click Music MV workflows |
| Retrieval | `video.status` | Poll a known video generation without resubmitting it |

Platform workflows keep credentials, credits, identifiers, validation, and durable job artifacts separate from Growth Studio. Query live resources before choosing templates, speakers, or restyle presets; do not treat saved catalog snapshots as permanent. See [`docs/api/platform-operations.md`](docs/api/platform-operations.md) for the complete operation inventory and [`docs/api/safety-and-recovery.md`](docs/api/safety-and-recovery.md) for billable-job recovery rules.

Growth Studio examples:

```bash
npm run cli -- growth-studio avatars list
npm run cli -- growth-studio folders list
npm run cli -- growth-studio folders ensure "Campaign Alpha"
npm run cli -- growth-studio upload image /absolute/path/product.webp
npm run cli -- growth-studio pdp create --payload /absolute/path/pdp.json --dry-run
npm run cli -- growth-studio wallet balance
npm run cli -- growth-studio video create-from-url "https://shop.example.com/products/item"
npm run cli -- growth-studio video create-from-json /absolute/path/payload.json
npm run cli -- growth-studio run-job --payload /absolute/path/payload.json --folder-name "Campaign Alpha"
npm run cli -- growth-studio resume /absolute/path/jobs/<job-dir>
npm run cli -- growth-studio video poll 627410861853514292
```

PDP is the merchant-neutral product-detail-page video workflow for the currently supported fashion/apparel category. It uses uploaded PixVerse image URLs, has a credential-free `--dry-run`, and requires explicit approval immediately before a live `--confirm-billable` submission. A live create is submitted once and recorded durably. See [`docs/api/growth-studio-pdp.md`](docs/api/growth-studio-pdp.md).

Legacy Growth Studio aliases such as `get`, `poll`, `run-job`, and `create-from-url` still work during `0.x` and emit one deprecation warning.

## Safety

- Platform uses `API-KEY` and a fresh `Ai-trace-id` for every new request.
- Growth Studio uses `Authorization: Bearer <PIXVERSE_GROWTH_API_KEY>`.
- Keep all IDs as strings.
- Use `run-job` for new billable work and `resume` for an existing durable job.
- For PDP, use `--dry-run`, optionally inspect the wallet snapshot, obtain approval immediately before `--confirm-billable`, and submit only once. A `202 Accepted` result is charged and queued.
- After an ambiguous billable response, inspect saved artifacts and known IDs before retrying.
- `resume` polls a saved ID only; it never resubmits a generation. If no ID was saved, it reports that reconciliation is required.
- Default automated tests use loopback or injected clients and do not submit paid jobs.

## Docs

- `docs/api/command-reference.md`
- `docs/api/growth-studio-pdp.md`
- `docs/api/platform-operations.md`
- `docs/api/safety-and-recovery.md`
- `.agents/skills/pixverse-api/SKILL.md`
- `.agents/skills/pixverse-platform-api/SKILL.md`
- `.agents/skills/pixverse-growth-studio-api/SKILL.md`

## Job Artifacts

Platform `run-job` writes under `pixverse-api-jobs/platform/` by default. Growth Studio `run-job` and live PDP create write under `jobs/` by default. Both providers preserve redacted request evidence, known IDs, polling snapshots, final state, and safe error records. PDP can additionally preserve `ledger-source-id.json`. Use the matching provider or PDP `resume` command with that job directory to continue polling without submitting another generation.
