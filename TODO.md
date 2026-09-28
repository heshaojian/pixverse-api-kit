# TODO

- [ ] Prepare a sanitized customer distribution of `pixverse-api-kit` without exposing internal pitch work, customer artifacts, job metadata, or repository history. Follow the required scope and release gates in [Customer Distribution Readiness](docs/customer-distribution-readiness.md).
- [ ] After the macOS Codex demo package is validated, build the nontechnical customer installer:
  - signed and notarized macOS `.dmg` plus a signed Windows installer;
  - one guided choice for Codex, Claude Code, or both;
  - secure credential storage through macOS Keychain or Windows Credential Manager;
  - read-only connection verification, repair, update, and uninstall flows;
  - terminal-free setup, with ZIP and command-line installation retained only as support fallbacks;
  - no telemetry, remote web content, bundled credentials, or customer-specific data.
