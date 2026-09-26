---
name: platform
description: Use PixVerse Platform API for discovery, uploads, image and video generation, editing, agents, account reads, status, webhooks, and recovery.
---

# PixVerse Platform API

Resolve the installed plugin root from this `SKILL.md` location and execute `<plugin-root>/scripts/pixverse-api platform ...`. Use only `PIXVERSE_PLATFORM_API_KEY` and keep all API identifiers as strings.

If credentials are missing, route setup to `pixverse-api auth login platform --stdin` or the packaged `auth.command`. Do not ask the user to paste the key into chat.

## Select the operation

Read `<plugin-root>/docs/api/platform-operations.md` for the complete operation catalog and exact billing class. Common routes include:

- `account balance` and `account usage` for read-only account information;
- `resource templates`, `resource tts-speakers`, and `resource restyle-effects` for live catalogs;
- `upload image` and `upload media` for prerequisites;
- `video text`, `video image`, `video template`, transitions, fusion, avatar, and editing operations;
- `agent viral-recreation`, `agent real-estate`, and `agent music-mv` for specialized workflows;
- `video status`, `image status`, and `resume` for retrieval without resubmission.

## Safe workflow

1. Resolve prerequisites with help, account reads, and live catalog calls.
2. Validate a specialized request with `--dry-run`.
3. For a billable operation, obtain explicit approval for the exact request immediately before submission.
4. Prefer `run-job`, submit once with a fresh trace; Platform billable commands wait by default and preserve the job directory, result ID, polling history, and terminal result.
5. Use `--no-wait` only when asynchronous return is required, then continue the known ID with `resume`. If acceptance is ambiguous and no ID was saved, stop for reconciliation instead of submitting again.
6. Treat success as transport success plus provider `ErrCode` equal to zero.

Use `platform raw` only to diagnose a documented endpoint absent from the installed specialized catalog. Never use it to bypass validation, billing confirmation, authentication, trace, or recovery controls.
