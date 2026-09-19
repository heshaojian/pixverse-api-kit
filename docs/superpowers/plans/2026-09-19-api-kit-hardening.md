# PixVerse API Kit Hardening Implementation Plan

> **Execution:** Use subagent-driven development for independent file groups, test-first changes, and a final integrated correctness/security review.

**Goal:** Apply the approved whole-repository recommendations while preserving the existing provider-first CLI and release behavior.

**Spec:** `docs/superpowers/specs/2026-09-19-api-kit-hardening-design.md`

## Task 1: Lock Platform operation-specific validation

**Files:** `src/platform/validators/video.js`, `src/platform/validators/specialized.js`, `test/unit/platform-validation.test.js`

- [ ] Add failing tests for missing `template_id`, missing sound-effect `prompt`, and more than three `mask_urls`.
- [ ] Fix the minimum validators without widening unrelated payload behavior.
- [ ] Add fixture-mutation coverage for required distinguishing fields.
- [ ] Run focused Platform validation and CLI tests.

## Task 2: Give Growth Studio durable, non-duplicating recovery

**Files:** `src/growth-studio/jobs.js`, `src/growth-studio/client.js`, `src/growth-studio/cli.js`, related Growth Studio tests

- [ ] Add failing tests for invalid timing options, malformed successful JSON, atomic/redacted artifacts, saved-ID resume, and ID-less reconciliation.
- [ ] Reuse shared artifact/redaction primitives where their contract fits.
- [ ] Add `growth-studio resume <job-dir>` with poll-only semantics.
- [ ] Preserve existing output envelopes and command compatibility.
- [ ] Run focused Growth Studio unit and integration tests.

## Task 3: Constrain credential destinations and dotenv input

**Files:** `src/platform/config.js`, `src/growth-studio/config.js`, configuration tests and examples

- [ ] Add failing tests for official origins, loopback development, rejected custom origins, and explicit provider opt-in.
- [ ] Enforce HTTPS official defaults and provider-specific unsafe custom-origin flags.
- [ ] Allowlist Growth Studio dotenv keys.
- [ ] Verify credentials never cross provider configuration.

## Task 4: Make default tests and CI clean-clone safe

**Files:** `package.json`, `.github/workflows/ci.yml`, release-script tests as needed

- [ ] Add a failing assertion that the default test command excludes ignored pitch fixtures.
- [ ] Make `npm test` run the no-paid-network API suite; add `test:pitches` for optional customer assets.
- [ ] Add credential-free CI for install, check, coverage, secret scan, and audit.
- [ ] Validate in a temporary local clone with no copied ignored assets.

## Task 5: Scan every tracked text surface for secrets

**Files:** `scripts/scan-secrets.js`, `test/unit/release-scripts.test.js`

- [ ] Add failing tests proving tracked deployment/payload/job metadata is included and binary files are ignored.
- [ ] Discover candidates from Git's tracked-file list and filter binary/dependency/build content safely.
- [ ] Retain actionable file-and-line diagnostics without printing secret values.
- [ ] Run the scanner and focused tests.

## Task 6: Align documentation and skills with actual behavior

**Files:** `README.md`, `docs/api/command-reference.md`, `docs/api/safety-and-recovery.md`, `.agents/skills/pixverse-growth-studio-api/SKILL.md`

- [ ] Document local install/link usage for the private package.
- [ ] Expand both provider command surfaces, dry-run/run-job/resume, artifacts, and custom-origin opt-ins.
- [ ] Correct webhook signature canonicalization.
- [ ] Describe Growth Studio as part of the unified checkout.
- [ ] Run documentation/skill contract tests and link checks.

## Task 7: Integrated review and release verification

- [ ] Run focused suites after each workstream merges into the shared tree.
- [ ] Run `npm run check`, coverage, default tests, optional pitch tests when fixtures exist, secret scan, high-severity audit, and `git diff --check`.
- [ ] Perform independent correctness and security reviews; resolve all critical/high findings.
- [ ] Prove the default suite in a clean temporary clone.
- [ ] Review the final diff and create conventional commits on `main`; do not push without a separate request.
