# PixVerse API Plugin Private Beta Design

**Date:** 2026-09-21

**Status:** Approved for specification; implementation requires review of this document

## Goal

Create private-beta PixVerse API Plugin packages that selected recipients can install in either Codex or Claude Code and use to operate the PixVerse Platform API and Growth Studio API through the existing agent-safe CLI and skills.

The deliverable is one sanitized release bundle containing separately validated Codex and Claude Code plugin archives. It is not a copy of the internal repository, does not contain Git history, and does not require recipients to clone this repository or install an npm package globally.

## Product Boundary

The product is named **PixVerse API Plugin**. The distribution repository is named `pixverse-api-plugin`, and the plugin identifier on both hosts is `pixverse-api`. It preserves the current product architecture:

```text
pixverse-api
├── platform
└── growth-studio
```

The general PixVerse web-product CLI remains the separate `pixverse` executable. Platform and Growth Studio retain independent credentials, configuration, billing boundaries, validation, and durable job artifacts.

The first private beta version is `0.3.0-beta.1`.

## Cross-Agent Architecture

The implementation has one canonical source for the runtime, API references, neutral examples, and skill content. A build adapter produces host-specific manifests, marketplace metadata, skill frontmatter, command paths, validation, and installation instructions.

The generated host packages never reference a shared directory outside their own plugin root. Each archive is self-contained because both Codex and Claude Code may copy or cache installed plugins independently.

The private beta release bundle contains:

```text
pixverse-api-plugin-0.3.0-beta.1/
├── pixverse-api-plugin-codex-0.3.0-beta.1.zip
├── pixverse-api-plugin-claude-0.3.0-beta.1.zip
├── INSTALL-CODEX.md
├── INSTALL-CLAUDE.md
├── MANIFEST.sha256
└── release-report.json
```

Each host archive contains one local marketplace and one self-contained plugin:

```text
Codex archive                          Claude Code archive
marketplace.json                       .claude-plugin/marketplace.json
plugins/pixverse-api/                  plugins/pixverse-api/
  .codex-plugin/plugin.json              .claude-plugin/plugin.json
  skills/                                 skills/
  scripts/pixverse-api                    scripts/pixverse-api
  runtime/                                runtime/
  examples/                               examples/
  docs/api/                               docs/api/
  README.md                               README.md
  LICENSE                                 LICENSE
  NOTICE                                  NOTICE
  SECURITY.md                             SECURITY.md
  SUPPORT.md                              SUPPORT.md
```

Neither archive contains a `.git` directory. Recipients extract only the archive for their host, register its root as a local marketplace, install `pixverse-api`, and start a new task or session so the skills are loaded.

## Why the Runtime Is Embedded

The plugin embeds the production CLI runtime and its pinned production dependencies. The plugin's `scripts/pixverse-api` wrapper resolves its own plugin root and invokes the embedded Node.js entry point. Skills use this wrapper rather than assuming a global `pixverse-api`, an internal checkout, or `npm link`.

This design provides one version boundary for agent instructions and executable behavior. It avoids a two-step plugin-plus-npm installation, prevents skill/CLI version skew, and supports installation without a package-registry account.

Recipients must provide Node.js 20 or newer. The private beta targets macOS and Linux. Windows support is not claimed until the wrapper and release artifact pass a native Windows smoke test.

## Host-Specific Manifests

### Codex

The Codex marketplace identifier is `pixverse-private-beta`. Its entry uses:

- source path `./plugins/pixverse-api`;
- installation policy `AVAILABLE`;
- authentication policy `ON_INSTALL`;
- category `Developer Tools`.

The Codex plugin manifest at `.codex-plugin/plugin.json` uses:

- name `pixverse-api`;
- version `0.3.0-beta.1`;
- author name `PixVerse`;
- skill path `./skills/`;
- display name `PixVerse API Plugin`;
- descriptions that distinguish Platform API, Growth Studio API, and the separate web CLI;
- no MCP, app, or hook fields because the package provides none.

### Claude Code

The Claude marketplace identifier is also `pixverse-private-beta`. Its manifest lives at `.claude-plugin/marketplace.json`, identifies PixVerse as the owner, and points to `./plugins/pixverse-api`.

The Claude plugin manifest at `.claude-plugin/plugin.json` uses the same plugin name, version, description, and author identity. Skills live at the plugin root under `skills/`. Executables remain under `scripts/`, not `bin/`, so the package remains compatible with Claude organization distribution rules. Claude skills invoke the wrapper through `${CLAUDE_PLUGIN_ROOT}/scripts/pixverse-api`.

Both manifests omit unverified website, privacy-policy, terms, email, and repository URLs. Neither claims public availability.

## Skills

Each package contains three customer-safe skills generated from the same canonical sources:

1. `start` routes requests to the correct provider and explains setup and shared safety rules.
2. `platform` covers Platform discovery, upload, generation, editing, specialized agents, polling, balance, usage, and recovery.
3. `growth-studio` covers Growth Studio uploads, wallet reads, product-page video workflows, PDP creation, polling, and recovery.

Claude exposes these as `/pixverse-api:start`, `/pixverse-api:platform`, and `/pixverse-api:growth-studio`. Codex retains normal automatic discovery and its native explicit-skill syntax. Host adapters may change only invocation metadata and wrapper paths; API semantics and safety rules remain identical.

The exported skills remove:

- personal names and home-directory paths;
- internal repository and worktree assumptions;
- customer names, campaigns, pitch pages, and deployment references;
- private Feishu links and internal planning documents;
- live job IDs, balances, media URLs, credentials, and account details.

Every command in the skills invokes the bundled wrapper through a host-supported plugin-relative path. Detailed endpoint catalogs and payload schemas remain in focused references so the entrypoint skills stay concise.

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

An internal build command creates both host candidates and the containing release bundle:

```text
npm run package:customer-plugin
```

The builder:

1. verifies a clean, explicit source allowlist;
2. creates an isolated temporary staging directory;
3. copies and transforms only approved files;
4. installs production dependencies from the lockfile into the staged runtime;
5. validates the shared skills and both host manifest sets;
6. runs denylist and secret checks against the staged tree;
7. renders independent Codex and Claude Code marketplace trees from the canonical sources;
8. creates two reproducible ZIPs with stable paths and normalized timestamps;
9. writes `MANIFEST.sha256` for every packaged file and both archives;
10. writes one `release-report.json` with version, per-host file counts, checks performed, and archive checksums;
11. extracts each archive into a separate temporary directory and runs host-specific installed-artifact smoke tests.

The builder never reads `.env`, job directories, browser state, or live credentials.

## Verification

The exact staged and extracted artifacts must pass:

- existing API unit, contract, integration, and end-to-end tests with paid network access disabled;
- at least 80% line, branch, function, and statement coverage for production CLI code;
- PDP omitted/null/object contract tests;
- CLI syntax checks;
- tracked-source and staged-artifact secret scans;
- dependency audit with no unresolved high-severity vulnerability;
- shared semantic checks for all three canonical skills;
- Codex skill and plugin-manifest validation;
- Claude Code skill, plugin, and marketplace validation with `claude plugin validate`;
- per-host marketplace path and policy validation;
- archive inventory and denylist checks;
- checksum verification;
- Node.js 20+ runtime check;
- extracted `pixverse-api --version` and top-level/provider help checks from both wrappers;
- representative credential-free Platform and PDP dry runs;
- mocked Growth Studio create, single-submit, poll, and resume checks;
- verification that no paid or authenticated network request occurs during testing.

An independent security review and code review inspect both staged trees, both archives, and the release report before either candidate is considered shareable. Missing host tooling blocks claiming support for that host; it is not silently skipped.

## Installation Experience

`INSTALL-CODEX.md` and `INSTALL-CLAUDE.md` give recipients the host-specific commands for this shared flow:

1. Verify the archive checksum.
2. Extract the archive to a stable local directory.
3. Register that directory as the selected host's local marketplace.
4. Install `pixverse-api@pixverse-private-beta`.
5. Configure the applicable provider credential in the server environment.
6. Start a new Codex task or Claude Code session.
7. Run a read-only status/help command and a credential-free dry run before any billable operation.

Each document also explains removal, upgrading to a later private-beta archive, reloading skills, and collecting redacted diagnostics for support. Claude documentation includes `claude --plugin-dir` ZIP testing and namespaced skill invocation; Codex documentation uses its marketplace and plugin commands.

## Release and Sharing Boundary

Implementation produces a local release candidate only. It does not:

- push changes or create a public repository;
- upload either archive to GitHub, npm, cloud storage, email, or chat;
- install the plugin into another person's environment;
- invite or notify a recipient;
- submit any billable PixVerse request.

Sharing the candidate requires a later explicit recipient-specific approval after legal, security, support, and release checks pass.

## Success Criteria

The work is complete when:

1. the latest PDP interface is implemented and tested;
2. one deterministic command builds the Codex archive, Claude Code archive, and containing release bundle;
3. both archives contain only the documented allowlist;
4. each host's manifest, marketplace, skills, CLI, dry-run, recovery, security, and checksum gates pass against its extracted artifact, while shared runtime coverage remains at least 80%;
5. installation and support documentation are understandable without access to the internal repository;
6. neither archive contains secrets, customer material, internal paths, private source links, or Git history;
7. both artifacts remain local until separate sharing approval is given.

## Deferred Work

The following are outside this private-beta design:

- public GitHub, npm, Codex marketplace, or Claude marketplace publication;
- automatic update delivery;
- Windows support claims;
- public privacy-policy or terms URLs;
- MCP servers or Codex apps;
- analytics or telemetry;
- customer-specific examples or onboarding;
- `1.0.0` stability guarantees.
