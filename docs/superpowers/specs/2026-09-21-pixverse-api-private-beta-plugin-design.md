# PixVerse API Plugin macOS Codex Demo Design

**Date:** 2026-09-21

**Status:** Revised specification awaiting review before implementation

## Goal

Create one sanitized, self-contained **PixVerse API Plugin** package that can be copied to a new macOS machine, installed into Codex, and used to demonstrate the PixVerse Platform API and Growth Studio API through the existing agent-safe CLI and skills.

This immediate deliverable is a local private-demo release candidate. It does not publish the plugin, install it on another person's machine, contain credentials, or require access to the internal repository.

## Product Boundary

The product is named **PixVerse API Plugin**. The future distribution repository is named `pixverse-api-plugin`, and the Codex plugin identifier is `pixverse-api`. The plugin preserves the current provider structure:

```text
pixverse-api
├── platform
└── growth-studio
```

The general PixVerse web-product CLI remains the separate `pixverse` executable. Platform and Growth Studio retain independent credentials, configuration, billing boundaries, validation, and durable job artifacts.

The first private demo version is `0.3.0-beta.1`.

## Demo Package

The release contains one ZIP archive for Codex on macOS:

```text
pixverse-api-plugin-codex-0.3.0-beta.1.zip
└── pixverse-api-plugin-codex-0.3.0-beta.1/
    ├── marketplace.json
    ├── plugins/pixverse-api/
    │   ├── .codex-plugin/plugin.json
    │   ├── skills/
    │   │   ├── start/
    │   │   ├── platform/
    │   │   └── growth-studio/
    │   ├── scripts/pixverse-api
    │   ├── runtime/
    │   ├── examples/
    │   ├── docs/api/
    │   ├── README.md
    │   ├── LICENSE
    │   ├── NOTICE
    │   ├── SECURITY.md
    │   └── SUPPORT.md
    ├── Install PixVerse API Plugin.command
    ├── Uninstall PixVerse API Plugin.command
    ├── INSTALL-MACOS.md
    ├── MANIFEST.sha256
    └── release-report.json
```

The archive contains no `.git` directory and no dependency on files outside its own root.

## macOS Demo Experience

The intended flow on a fresh Mac is:

1. Install and sign in to Codex.
2. Install Node.js 20 or newer if the preflight reports it missing.
3. Extract the ZIP.
4. Double-click `Install PixVerse API Plugin.command`.
5. Follow the printed Codex restart instruction.
6. Configure Platform or Growth Studio credentials outside prompts and chat history.
7. Start a new Codex task and ask the PixVerse API Plugin for help or a read-only account check.

The installer performs a read-only preflight before making changes, copies the versioned package to a stable user-local application-support directory, registers its root as the `pixverse-private-beta` local marketplace, and installs `pixverse-api`. It fails with a plain-language message if Codex, Node.js, the package manifest, or the archive checksum is invalid.

The installer does not request, read, copy, or store API keys. `INSTALL-MACOS.md` explains how the demo operator supplies credentials through environment variables. The uninstaller removes only paths and Codex registration created by this package and leaves credentials untouched.

The `.command` helpers are conveniences for this private demo, not a claim of a signed or notarized consumer installer. The documentation includes a command-line fallback for macOS Gatekeeper or shell-association issues.

## Embedded Runtime

The plugin embeds the production CLI runtime and its pinned production dependencies. `scripts/pixverse-api` resolves its own plugin root and invokes the embedded Node.js entry point. Skills use this wrapper rather than assuming a global `pixverse-api`, an internal checkout, or `npm link`.

This provides one version boundary for agent instructions and executable behavior, prevents skill/CLI version skew, and avoids requiring a package-registry account. The JavaScript runtime supports both Apple Silicon and Intel Macs through the user's installed Node.js 20+ runtime.

## Codex Manifest and Marketplace

The Codex marketplace identifier is `pixverse-private-beta`. Its `pixverse-api` entry uses:

- source path `./plugins/pixverse-api`;
- installation policy `AVAILABLE`;
- authentication policy `ON_INSTALL`;
- category `Developer Tools`.

The plugin manifest at `.codex-plugin/plugin.json` uses:

- name `pixverse-api`;
- version `0.3.0-beta.1`;
- author name `PixVerse`;
- skill path `./skills/`;
- display name `PixVerse API Plugin`;
- descriptions that distinguish Platform API, Growth Studio API, and the separate web CLI;
- no MCP, app, or hook fields because the package provides none.

Unverified website, privacy-policy, terms, email, and repository URLs are omitted. The package does not claim public marketplace availability.

## Skills

The package contains three customer-safe skills:

1. `start` routes requests to the correct provider and explains setup and shared safety rules.
2. `platform` covers Platform discovery, upload, generation, editing, specialized agents, polling, balance, usage, and recovery.
3. `growth-studio` covers Growth Studio uploads, wallet reads, product-page video workflows, PDP creation, polling, and recovery.

Codex discovers these through the plugin manifest and supports its native explicit-skill syntax. Every command invokes the bundled wrapper through a plugin-relative path. Detailed endpoint catalogs and payload schemas remain in focused references so the entry skills stay concise.

The exported skills remove personal names, home-directory paths, internal repository assumptions, customer campaigns, private Feishu links, live job IDs, balances, media URLs, credentials, and account details.

## Latest PDP Contract Prerequisite

The package must incorporate the current Growth Studio PDP contract before release. The create endpoint remains:

```text
POST https://growth-api.pixverse.ai/openapi/v1/ka/videos
```

The public PDP interface accepts:

- a required `product` object;
- an omitted `video` field;
- `video: null`; or
- a `video` object whose `mode` is `standard` or `pro` and whose other fields follow the documented limits.

Omitted and `null` video input are normalized by omitting `video` from the outbound request. When a non-null video object is supplied, `mode` remains required. Tests and customer documentation cover all three accepted shapes.

## Documentation and Examples

The plugin includes only recipient-facing material needed for the demo:

- macOS installation, upgrade, and removal;
- provider selection and credentials;
- command and capability references;
- the Platform operation catalog;
- the Growth Studio PDP contract;
- billable-operation approvals;
- timeout, reconciliation, and resume behavior;
- redacted diagnostics and support guidance.

Examples use neutral products, `example.com`, synthetic identifiers, and fake media paths. Every billable command is labeled. The first-run flow begins with help, read-only account checks, or credential-free dry runs; no example authorizes a live generation.

## Credentials and Authentication

The package contains no credentials. The demo operator supplies:

- `PIXVERSE_PLATFORM_API_KEY` for Platform API;
- `PIXVERSE_GROWTH_API_KEY` for Growth Studio API;
- provider-specific base URL overrides only when explicitly required.

Skills never ask users to paste credentials into prompts or payloads. The CLI keeps Platform `API-KEY` authentication separate from Growth Studio bearer authentication and never falls back from one credential to the other.

## Sanitized Export Boundary

The artifact is built from an explicit allowlist. The builder copies individual approved paths into a temporary staging directory; it never copies the repository and then deletes unwanted files.

Allowed categories are production CLI files under `src/`, pinned production dependency metadata, the three sanitized skills and required references, selected public API documentation, neutral examples, and package-specific installation, security, support, notice, and license files.

The builder rejects artifacts containing:

- Git metadata or source maps with internal paths;
- `.env` files or credential-like values;
- `deploy/`, `payloads/`, `pixverse-api-jobs/`, `jobs/`, `qa/`, `assets/`, or customer-specific test data;
- `docs/brand-pitches/` or `docs/superpowers/`;
- customer, campaign, or personal names from the maintained denylist;
- internal absolute paths, private document URLs, live PixVerse IDs, balances, request traces, or generated-media URLs.

Build output goes under ignored `dist/` storage. Temporary staging is removed after either success or failure.

## Dependency and License Boundary

The embedded runtime contains only production dependencies installed from the committed lockfile. Development dependencies and repository tooling are excluded. The package includes third-party notices for every embedded dependency.

The private-demo license is proprietary and evaluation-only. Legal approval of the exact `LICENSE` and `NOTICE` text is a sharing gate: an archive may be built and tested locally, but it must not be shared until approval is recorded.

## Deterministic Build

One internal command creates the candidate:

```text
npm run package:customer-plugin
```

The builder:

1. verifies the explicit source allowlist;
2. stages only approved files in an isolated temporary directory;
3. installs production dependencies from the lockfile;
4. validates the three skills, marketplace, and Codex manifest;
5. runs denylist and secret checks against the staged tree;
6. creates a reproducible ZIP with stable paths and normalized timestamps;
7. writes `MANIFEST.sha256` and `release-report.json` with version, inventory, checks, and archive checksum;
8. extracts the ZIP to a second temporary location and tests the installed artifact and macOS installer flow.

The builder never reads `.env`, job directories, browser state, or live credentials.

## Verification

The exact staged and extracted package must pass:

- existing unit, contract, integration, and end-to-end tests with paid network access disabled;
- at least 80% line, branch, function, and statement coverage for production CLI code;
- PDP omitted, null, and object contract tests;
- CLI syntax checks and dependency audit with no unresolved high-severity vulnerability;
- tracked-source and staged-artifact secret scans;
- Codex skill, marketplace, and plugin-manifest validation;
- archive inventory, denylist, and checksum checks;
- extracted `pixverse-api --version`, top-level help, and provider help checks;
- representative credential-free Platform and PDP dry runs;
- mocked Growth Studio create, single-submit, poll, and resume checks;
- installer and uninstaller tests under an isolated temporary home directory;
- confirmation that no paid or authenticated network request occurs during packaging or verification.

An independent code review and security review inspect the staged tree, archive, installer behavior, and release report before the candidate is considered demo-ready.

## Release Boundary

Implementation produces a local release candidate only. It does not push changes, publish a repository or package, upload the archive, install it on another machine, notify a recipient, modify credentials, or submit a billable PixVerse request.

Moving the archive to the new demo Mac requires a later explicit sharing action after legal, security, support, and release checks pass.

## Success Criteria

The work is complete when:

1. the latest PDP interface is implemented and tested;
2. one deterministic command builds the self-contained Codex/macOS ZIP;
3. the extracted archive contains only the documented allowlist;
4. the plugin manifest, marketplace, skills, embedded CLI, dry runs, recovery, installer, security, and checksum gates pass;
5. shared runtime coverage is at least 80%;
6. installation and support instructions work on a clean macOS test environment without access to the internal repository;
7. the archive contains no secrets, customer material, internal paths, private source links, or Git history;
8. the artifact remains local until separate sharing approval is given.

## Deferred Work

The following remains in `TODO.md` or outside this demo release:

- a signed and notarized graphical macOS installer;
- a signed Windows installer and native Windows validation;
- Claude Code packaging and validation;
- one guided installer that can install Codex, Claude Code, or both;
- secure credential storage in macOS Keychain and Windows Credential Manager;
- public GitHub, npm, Codex marketplace, or Claude marketplace publication;
- automatic updates, telemetry, MCP servers, Codex apps, and `1.0.0` stability guarantees.
