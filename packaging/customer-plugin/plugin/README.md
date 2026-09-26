# PixVerse API Plugin

PixVerse API Plugin gives Codex a self-contained CLI and three skills for the PixVerse Platform API and Growth Studio API.

Use `start` for setup and provider routing, `platform` for Platform API operations, and `growth-studio` for Growth Studio workflows. The separate PixVerse web-product CLI is not included.

The plugin requires macOS, Codex, and Node.js 20 or newer. It contains no API credentials. Use `auth.command` from the extracted package, or run `pixverse-api auth login platform --stdin` and `pixverse-api auth login growth-studio --stdin`. Never place keys in chat, payload files, or command arguments.

Begin with a help command or dry run. Billable generation requires explicit approval for the exact request immediately before one submission. Preserve job artifacts and resume known jobs instead of recreating uncertain submissions.

See `INSTALL-MACOS.md` beside the extracted plugin package for installation and removal. See `docs/api/` for the command, capability, and recovery references.
