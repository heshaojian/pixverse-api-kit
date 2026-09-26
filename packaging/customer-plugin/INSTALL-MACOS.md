# Install PixVerse API Plugin on macOS

## Requirements

- macOS on Apple Silicon or Intel
- Codex installed and signed in
- Node.js 20 or newer

## Install

1. Keep the extracted package together in one directory.
2. Double-click `install.command`.
3. If macOS blocks the helper, Control-click it, choose **Open**, and confirm. The command-line fallback is `zsh ./install.command` from the extracted directory.
4. Close and reopen Codex after installation so a new task can discover the skills.
5. Double-click `auth.command` and paste the dedicated Platform and/or Growth Studio API keys.
6. Close and reopen Codex again after saving credentials.
7. Ask the PixVerse API Plugin to show help, check auth status, or perform a credential-free dry run.

The installer verifies the package, installs the API CLI using the same global Node pattern as the PixVerse CLI, registers the local Codex marketplace from that installed package, and installs `pixverse-api`. If the `pixverse` CLI is already installed, the installer places `pixverse-api` beside it; otherwise it uses `npm prefix -g`. It does not request, read, copy, or store API credentials.

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

Do not paste a key into Codex chat, a payload file, or a command argument.

## Upgrade

Run the installer from the newer verified package. It keeps the receipt-owned older version until Codex registration succeeds, then removes that older package directory. If registration fails, the installer restores the older marketplace, plugin registration, and CLI shortcut.

## Remove

Double-click `uninstall.command`, or run `zsh ./uninstall.command`. Removal uses the installer receipt and deletes only the registered plugin package and owned `pixverse-api` shortcut. It does not remove credentials or unrelated files.

## Private demo restriction

This package is a private demo candidate. Its draft evaluation license is not approved for external distribution. Do not upload, publish, or forward it without recorded legal and release approval.
