# PixVerse API Agent Kit Private Beta Plugin Design

**Date:** 2026-09-21

**Status:** Approved for specification; implementation requires review of this document

## Goal

Create a private-beta Codex plugin that selected recipients can install as one package and use to operate the PixVerse Platform API and Growth Studio API through the existing agent-safe CLI and skills.

The deliverable is a sanitized, self-contained archive. It is not a copy of the internal repository, does not contain Git history, and does not require recipients to clone this repository or install an npm package globally.

## Product Boundary

The plugin is named `pixverse-api-agent-kit`. It preserves the current product architecture:

```text
pixverse-api
├── platform
└── growth-studio
```

The general PixVerse web-product CLI remains the separate `pixverse` executable. Platform and Growth Studio retain independent credentials, configuration, billing boundaries, validation, and durable job artifacts.

The first private beta version is `0.3.0-beta.1`.

## Selected Distribution Model

The private beta is distributed as a local Codex marketplace archive:

```text
pixverse-api-private-beta-0.3.0-beta.1/
├── marketplace.json
├── plugins/
│   └── pixverse-api-agent-kit/
│       ├── .codex-plugin/plugin.json
│       ├── skills/
│       │   ├── pixverse-api/
│       │   ├── pixverse-platform-api/
│       │   └── pixverse-growth-studio-api/
│       ├── scripts/
│       │   └── pixverse-api
│       ├── runtime/
│       │   ├── src/
│       │   ├── node_modules/
│       │   ├── package.json
│       │   └── package-lock.json
│       ├── examples/
│       ├── docs/api/
│       ├── README.md
│       ├── LICENSE
│       ├── NOTICE
│       ├── SECURITY.md
│       └── SUPPORT.md
├── INSTALL.md
├── MANIFEST.sha256
└── release-report.json
```

The archive contains no `.git` directory. A recipient extracts it, registers the extracted root as a local marketplace, installs `pixverse-api-agent-kit@pixverse-private-beta`, and starts a new Codex task so the skills are loaded.

## Why the Runtime Is Embedded

The plugin embeds the production CLI runtime and its pinned production dependencies. The plugin's `scripts/pixverse-api` wrapper resolves its own plugin root and invokes the embedded Node.js entry point. Skills use this wrapper rather than assuming a global `pixverse-api`, an internal checkout, or `npm link`.

This design provides one version boundary for agent instructions and executable behavior. It avoids a two-step plugin-plus-npm installation, prevents skill/CLI version skew, and supports installation without a package-registry account.

Recipients must provide Node.js 20 or newer. The private beta targets macOS and Linux. Windows support is not claimed until the wrapper and release artifact pass a native Windows smoke test.

## Marketplace and Plugin Manifests

The marketplace identifier is `pixverse-private-beta`. Its entry uses:

- source path `./plugins/pixverse-api-agent-kit`;
- installation policy `AVAILABLE`;
- authentication policy `ON_INSTALL`;
- category `Developer Tools`.

The plugin manifest uses:

- name `pixverse-api-agent-kit`;
- version `0.3.0-beta.1`;
- author name `PixVerse`;
- skill path `./skills/`;
- display name `PixVerse API Agent Kit`;
- descriptions that distinguish Platform API, Growth Studio API, and the separate web CLI;
- no MCP, app, or hook fields because the package provides none.

The manifest omits unverified website, privacy-policy, terms, email, and repository URLs. It does not claim public availability.

## Skills

The package contains three customer-safe skills:

1. `pixverse-api` routes requests to the correct provider and explains setup and shared safety rules.
2. `pixverse-platform-api` covers Platform discovery, upload, generation, editing, specialized agents, polling, balance, usage, and recovery.
3. `pixverse-growth-studio-api` covers Growth Studio uploads, wallet reads, product-page video workflows, PDP creation, polling, and recovery.

The exported skills remove:

- personal names and home-directory paths;
- internal repository and worktree assumptions;
- customer names, campaigns, pitch pages, and deployment references;
- private Feishu links and internal planning documents;
- live job IDs, balances, media URLs, credentials, and account details.

Every command in the skills invokes the bundled wrapper through a plugin-relative path. Detailed endpoint catalogs and payload schemas remain in focused references so the entrypoint skills stay concise.

## Latest PDP Contract Prerequisite

The release must incorporate the current Growth Studio PDP contract before packaging.

The create endpoint remains:

```text
POST https://growth-api.pixverse.ai/openapi/v1/ka/videos
```

The public PDP interface accepts:

- a required `product` object;
- an omitted `video` field;
- `video: null`; or
- a `video` object whose `mode` is `standard` or `pro` and whose other fields follow the documented limits.

Omitted and `null` video input are normalized by omitting `video` from the outbound request. When a non-null video object is supplied, `mode` remains required. This resolves the top-level optional/default behavior without sending an unnecessary `null` value and preserves strict validation for explicit generation parameters.

Tests and customer documentation must cover all three accepted shapes. Existing callers that provide a video object remain compatible.

## Customer-Safe Documentation and Examples

The plugin includes only API documentation needed by a recipient:

- installation and environment setup;
- provider selection;
- command reference;
- Platform operation catalog;
- Growth Studio PDP contract;
- billable-operation approvals;
- timeout, reconciliation, and resume behavior;
- support-safe diagnostic artifacts;
- compatibility and deprecation policy.

Examples use neutral products, `example.com`, synthetic identifiers, and fake media paths. Every billable command is labeled. The first-run flow starts with help, balance or discovery reads, and credential-free dry runs. No example authorizes a live generation.

## Credentials and Authentication

The package contains no credentials. Recipients configure environment variables outside the plugin:

- `PIXVERSE_PLATFORM_API_KEY` for Platform API;
- `PIXVERSE_GROWTH_API_KEY` for Growth Studio API;
- provider-specific base URL overrides only when explicitly needed.

Skills must never ask recipients to paste credentials into prompts or payloads. The CLI keeps Platform `API-KEY` authentication separate from Growth Studio bearer authentication and never falls back from one credential to the other.

## Sanitized Export Boundary

The artifact is constructed from an explicit allowlist. The builder copies individual approved paths into a temporary staging directory. It never copies the repository and then deletes unwanted files.

Allowed source categories are:

- production CLI files under `src/`;
- pinned production dependency metadata;
- the three sanitized skills and their required references;
- selected public API documentation;
- neutral examples;
- plugin, marketplace, installation, security, support, notice, and license files.

The builder rejects an artifact containing any of the following:

- Git metadata or source maps with internal paths;
- `.env` files or credential-like values;
- `deploy/`, `payloads/`, `pixverse-api-jobs/`, `jobs/`, `qa/`, `assets/`, or customer-specific test data;
- `docs/brand-pitches/` or `docs/superpowers/`;
- customer, campaign, or personal names from the maintained denylist;
- internal absolute paths;
- private document URLs;
- live PixVerse IDs, balances, request traces, or generated-media URLs.

The build output is written under ignored `dist/` storage. Temporary staging is removed after a successful or failed build.

## Dependency and License Boundary

The embedded runtime contains only production dependencies installed from the committed lockfile. Development dependencies and repository tooling are excluded.

The plugin includes third-party notices for every embedded dependency. The private beta license is proprietary and evaluation-only: copyright remains with PixVerse, use is limited to the recipient's separate written agreement, and redistribution rights are not granted. Legal approval of the exact `LICENSE` and `NOTICE` text is a release gate; a candidate archive may be built for internal verification but must not be shared until that approval is recorded.

## Deterministic Build

An internal build command creates the release candidate:

```text
npm run package:customer-plugin
```

The builder:

1. verifies a clean, explicit source allowlist;
2. creates an isolated temporary staging directory;
3. copies and transforms only approved files;
4. installs production dependencies from the lockfile into the staged runtime;
5. validates all skills and the plugin manifest;
6. runs denylist and secret checks against the staged tree;
7. creates a reproducible ZIP with stable paths and normalized timestamps;
8. writes `MANIFEST.sha256` for every packaged file;
9. writes `release-report.json` with version, file count, checks performed, and archive checksum;
10. extracts the archive into a second temporary directory and runs installed-artifact smoke tests.

The builder never reads `.env`, job directories, browser state, or live credentials.

## Verification

The exact staged and extracted artifacts must pass:

- existing API unit, contract, integration, and end-to-end tests with paid network access disabled;
- at least 80% line, branch, function, and statement coverage for production CLI code;
- PDP omitted/null/object contract tests;
- CLI syntax checks;
- tracked-source and staged-artifact secret scans;
- dependency audit with no unresolved high-severity vulnerability;
- skill validation for all three skills;
- plugin manifest validation;
- marketplace path and policy validation;
- archive inventory and denylist checks;
- checksum verification;
- Node.js 20+ runtime check;
- extracted `pixverse-api --version` and top-level/provider help checks;
- representative credential-free Platform and PDP dry runs;
- mocked Growth Studio create, single-submit, poll, and resume checks;
- verification that no paid or authenticated network request occurs during testing.

An independent security review and code review inspect the final staged diff and release report before the candidate is considered shareable.

## Installation Experience

`INSTALL.md` gives the recipient this flow:

1. Verify the archive checksum.
2. Extract the archive to a stable local directory.
3. Register that directory as a local Codex marketplace.
4. Install `pixverse-api-agent-kit@pixverse-private-beta`.
5. Configure the applicable provider credential in the server environment.
6. Start a new Codex task.
7. Run a read-only status/help command and a credential-free dry run before any billable operation.

The document also explains removal, upgrading to a later private-beta archive, and how to collect redacted diagnostics for support.

## Release and Sharing Boundary

Implementation produces a local release candidate only. It does not:

- push changes or create a public repository;
- upload the archive to GitHub, npm, cloud storage, email, or chat;
- install the plugin into another person's environment;
- invite or notify a recipient;
- submit any billable PixVerse request.

Sharing the candidate requires a later explicit recipient-specific approval after legal, security, support, and release checks pass.

## Success Criteria

The work is complete when:

1. the latest PDP interface is implemented and tested;
2. one deterministic command builds the private-beta marketplace archive;
3. the archive contains only the documented allowlist;
4. manifest, skills, CLI, dry-run, recovery, coverage, security, dependency, and checksum gates pass against the extracted artifact;
5. installation and support documentation are understandable without access to the internal repository;
6. the archive contains no secrets, customer material, internal paths, private source links, or Git history;
7. the artifact remains local until separate sharing approval is given.

## Deferred Work

The following are outside this private-beta design:

- public GitHub or npm publication;
- automatic update delivery;
- Windows support claims;
- public privacy-policy or terms URLs;
- MCP servers or Codex apps;
- analytics or telemetry;
- customer-specific examples or onboarding;
- `1.0.0` stability guarantees.
