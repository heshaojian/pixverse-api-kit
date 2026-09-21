import path from "node:path";

export const CUSTOMER_PLUGIN_RELEASE = Object.freeze({
  pluginName: "pixverse-api",
  marketplaceName: "pixverse-private-beta",
  version: "0.3.0-beta.1",
  archiveBaseName: "pixverse-api-plugin-codex-0.3.0-beta.1",
  sourceDateEpoch: 1_788_739_200,
});

export const CUSTOMER_PLUGIN_ALLOWLIST = Object.freeze({
  sourceDirectories: Object.freeze(["src"]),
  apiDocuments: Object.freeze([
    "docs/api/command-reference.md",
    "docs/api/growth-studio-pdp.md",
    "docs/api/platform-operations.md",
    "docs/api/safety-and-recovery.md",
  ]),
  packageFiles: Object.freeze(["package.json", "package-lock.json"]),
  pluginSource: "packaging/customer-plugin",
});

export const CUSTOMER_PLUGIN_DENIED_PATHS = Object.freeze([
  ".env",
  ".git",
  "assets",
  "deploy",
  "docs/brand-pitches",
  "docs/superpowers",
  "jobs",
  "payloads",
  "pixverse-api-jobs",
  "pixverse-cli-jobs",
  "projects",
  "qa",
  "research",
  "test",
]);

export function customerPluginOutputDirectory(repoRoot) {
  return path.join(
    path.resolve(repoRoot),
    "dist",
    "customer-plugin",
    CUSTOMER_PLUGIN_RELEASE.version,
  );
}
