# Install PixVerse API Plugin on macOS

## Requirements

- macOS on Apple Silicon or Intel
- Node.js 20 or newer
- At least one supported coding agent: Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot CLI, or OpenCode

## Install

1. Keep the extracted package together in one directory.
2. Double-click `install.command`.
3. If macOS blocks the helper, Control-click it, choose **Open**, and confirm. The command-line fallback is `zsh ./install.command` from the extracted directory.
4. Close and reopen each coding agent after installation so a new task can discover the skills.
5. Double-click `auth.command` and paste the dedicated Platform and/or Growth Studio API keys.
6. Close and reopen the coding agent again after saving credentials.
7. Ask the PixVerse API Plugin to show help, check auth status, or perform a credential-free dry run.

The installer verifies the package, installs the API CLI using the same global Node pattern as the PixVerse CLI, and registers the plugin with every supported coding agent it finds on this Mac. If the `pixverse` CLI is already installed, the installer places `pixverse-api` beside it; otherwise it uses `npm prefix -g`. It does not request, read, copy, or store API credentials.

## Supported agents

| Agent | How it is registered |
|---|---|
| Codex | Native plugin from the local `pixverse-private-beta` marketplace |
| Claude Code | Native plugin from the same local marketplace (`claude plugin install pixverse-api@pixverse-private-beta`) |
| Gemini CLI | Standalone Agent Skills in `~/.gemini/skills/` |
| Cursor | Standalone Agent Skills in `~/.cursor/skills/` |
| GitHub Copilot CLI | Standalone Agent Skills in `~/.copilot/skills/` |
| OpenCode | Standalone Agent Skills in `~/.config/opencode/skills/` |

An agent counts as found when its command is on `PATH` or its settings folder exists in your home folder. Codex and Claude Code need their command-line tool on `PATH` to register the plugin. Standalone skills are named `pixverse-api-start`, `pixverse-api-platform`, and `pixverse-api-growth-studio`, and they call the `pixverse-api` command that the installer places on `PATH`. The installer never replaces a same-named skill folder that it did not create.

To choose agents explicitly, set `PIXVERSE_API_AGENTS` to a comma-separated list:

```sh
PIXVERSE_API_AGENTS=claude,cursor zsh ./install.command
```

Accepted names are `codex`, `claude`, `gemini`, `cursor`, `copilot`, and `opencode`. The default, `auto`, registers every agent that was found. If one agent cannot be registered, the installer reports it and continues with the others; it rolls back only when no agent could be registered.

For any other agent that reads Agent Skills (`SKILL.md` folders), copy the three folders in `agent-skills/` from the extracted package into that agent's skills folder.

Installed CLI layout:

```text
<selected npm prefix>/lib/node_modules/pixverse-api
<selected npm prefix>/bin/pixverse-api -> ../lib/node_modules/pixverse-api/dist/index.js
```

## Credentials

Most users should use `auth.command`. It saves keys for the current macOS user under `~/Library/Application Support/PixVerse/api-plugin/credentials.env` with private file permissions. Platform and Growth Studio use dedicated API keys and never substitute for one another.

Command-line fallback:

```sh
printf '%s' '<platform-api-key>' | pixverse-api auth login platform --stdin
printf '%s' '<growth-studio-api-key>' | pixverse-api auth login growth-studio --stdin
pixverse-api auth status
```

Do not paste a key into an agent chat, a payload file, or a command argument.

## Upgrade

Run the installer from the newer verified package. It keeps the receipt-owned older version until registration succeeds, then removes that older package directory. If Codex registration fails, the installer restores the older marketplace, plugin registration, and CLI shortcut. Claude Code is re-pointed to the new version, standalone skills are replaced in place, and agents that are no longer selected have their older registration removed.

## Remove

Double-click `uninstall.command`, or run `zsh ./uninstall.command`. Removal uses the installer receipt and deletes only the agent registrations it recorded, the standalone skill folders it created, the registered plugin package, and the owned `pixverse-api` shortcut. It does not remove credentials or unrelated files.

## Private demo restriction

This package is a private demo candidate. Its draft evaluation license is not approved for external distribution. Do not upload, publish, or forward it without recorded legal and release approval.
