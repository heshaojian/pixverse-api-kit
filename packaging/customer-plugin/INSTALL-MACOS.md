# Install PixVerse API Plugin on macOS

## Requirements

- macOS on Apple Silicon or Intel
- Codex installed and signed in
- Node.js 20 or newer

## Install

1. Keep the extracted package together in one directory.
2. Double-click `Install PixVerse API Plugin.command`.
3. If macOS blocks the helper, Control-click it, choose **Open**, and confirm. The command-line fallback is `zsh "./Install PixVerse API Plugin.command"` from the extracted directory.
4. Close and reopen Codex after installation so a new task can discover the skills.
5. Ask the PixVerse API Plugin to show help or perform a credential-free dry run.

The installer verifies the package, copies it to a versioned directory under your user Library, registers the local marketplace, and installs `pixverse-api`. It does not request, read, copy, or store API credentials.

## Credentials

Provide `PIXVERSE_PLATFORM_API_KEY` or `PIXVERSE_GROWTH_API_KEY` through the environment used to launch Codex. Do not paste a key into Codex chat, a payload file, or a command argument. The two keys are independent and never substitute for one another.

## Upgrade

Run the installer from the newer verified package. It keeps the receipt-owned older version until Codex registration succeeds, then removes that older package directory. If registration fails, the installer restores the older marketplace and plugin registration.

## Remove

Double-click `Uninstall PixVerse API Plugin.command`, or run `zsh "./Uninstall PixVerse API Plugin.command"`. Removal uses the installer receipt and deletes only the registered plugin version. It does not remove credentials or unrelated files.

## Private demo restriction

This package is a private demo candidate. Its draft evaluation license is not approved for external distribution. Do not upload, publish, or forward it without recorded legal and release approval.
