---
name: start
description: Start here for PixVerse API Plugin setup, provider selection, safety boundaries, and routing to Platform or Growth Studio.
---

# PixVerse API Plugin

Use this skill to choose the correct server-side PixVerse API. This plugin is separate from the PixVerse web-product CLI named `pixverse`.

## CLI location

Resolve the installed plugin root from this `SKILL.md` location, then run:

```text
<plugin-root>/scripts/pixverse-api --help
```

Do not assume a global command, package checkout, or package-manager link.

## Provider choice

- Use the `platform` skill for Platform API discovery, uploads, generation, editing, specialized agents, account reads, status, webhooks, and recovery.
- Use the `growth-studio` skill for Growth Studio PDP product videos, uploads, wallet reads, general product-page video workflows, status, and recovery.
- Platform uses only `PIXVERSE_PLATFORM_API_KEY`.
- Growth Studio uses only `PIXVERSE_GROWTH_API_KEY`.
- Never substitute one provider's key, balance, identifiers, or approval for the other.

## Shared safety

Start with help, discovery, read-only checks, or a dry run. Before any billable request, show the exact provider, operation, payload, and known cost information, then obtain explicit approval for that submission. Submit once, preserve returned identifiers and job artifacts, and resume polling rather than recreating an unclear or interrupted job.

Never ask the user to paste an API key into chat, a prompt, a payload, or a command argument. Keep all provider identifiers as strings.
