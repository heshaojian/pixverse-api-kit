import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CUSTOMER_PLUGIN_ALLOWLIST } from "../../scripts/customer-plugin/config.js";
import { stageCustomerPlugin } from "../../scripts/customer-plugin/stage.js";

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("staging creates the self-contained marketplace from approved sources", async (t) => {
  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-stage-"));
  t.after(() => fs.rm(stageRoot, { recursive: true, force: true }));

  const result = await stageCustomerPlugin({
    repoRoot: process.cwd(),
    stageRoot,
    installDependencies: false,
  });

  assert.equal(await exists(path.join(result.packageRoot, ".agents/plugins/marketplace.json")), true);
  assert.equal(await exists(path.join(result.pluginRoot, ".codex-plugin/plugin.json")), true);
  assert.equal(await exists(path.join(result.pluginRoot, "scripts/pixverse-api")), true);
  assert.equal(await exists(path.join(result.pluginRoot, "runtime/src/cli.js")), true);
  assert.equal(await exists(path.join(result.pluginRoot, "runtime/package.json")), true);
  assert.equal(await exists(path.join(result.pluginRoot, "runtime/package-lock.json")), true);
  assert.equal(await exists(path.join(result.pluginRoot, "docs/api/platform-operations.md")), true);
  assert.equal(await exists(path.join(result.packageRoot, "payloads")), false);
  assert.equal(await exists(path.join(result.packageRoot, "docs/superpowers")), false);
  assert.deepEqual(result.files, [...result.files].sort());

  const stagedRuntimeSources = result.files
    .filter((file) => file.startsWith("plugins/pixverse-api/runtime/src/"))
    .map((file) => file.replace("plugins/pixverse-api/runtime/", ""));
  assert.deepEqual(stagedRuntimeSources, [...CUSTOMER_PLUGIN_ALLOWLIST.runtimeFiles].sort());

  const stagedOperations = await fs.readFile(
    path.join(result.pluginRoot, "runtime/src/platform/operations.js"),
    "utf8",
  );
  assert.doesNotMatch(stagedOperations, /feishu\.cn/);
  assert.match(stagedOperations, /https:\/\/docs\.platform\.pixverse\.ai\//);

  const wrapperMode = (await fs.stat(path.join(result.pluginRoot, "scripts/pixverse-api"))).mode;
  assert.notEqual(wrapperMode & 0o100, 0);
});

test("staged runtime metadata includes only production dependencies", async (t) => {
  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-runtime-"));
  t.after(() => fs.rm(stageRoot, { recursive: true, force: true }));

  const { pluginRoot } = await stageCustomerPlugin({
    repoRoot: process.cwd(),
    stageRoot,
    installDependencies: false,
  });
  const runtimeRoot = path.join(pluginRoot, "runtime");
  const packageJson = JSON.parse(await fs.readFile(path.join(runtimeRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await fs.readFile(path.join(runtimeRoot, "package-lock.json"), "utf8"));

  assert.deepEqual(packageJson.dependencies, { "json-bigint": "1.0.0" });
  assert.equal("devDependencies" in packageJson, false);
  assert.equal(packageLock.packages[""].name, "pixverse-api-plugin-runtime");
  assert.equal(Object.values(packageLock.packages).some((entry) => entry.dev === true), false);
});

test("staging rejects an allowlisted runtime source that is a symlink", async (t) => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-source-"));
  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-stage-"));
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));
  t.after(() => fs.rm(stageRoot, { recursive: true, force: true }));

  await fs.cp(path.join(process.cwd(), "src"), path.join(fixtureRoot, "src"), { recursive: true });
  await fs.cp(
    path.join(process.cwd(), "packaging/customer-plugin"),
    path.join(fixtureRoot, "packaging/customer-plugin"),
    { recursive: true },
  );
  await fs.cp(path.join(process.cwd(), "docs/api"), path.join(fixtureRoot, "docs/api"), {
    recursive: true,
  });
  await fs.copyFile(path.join(process.cwd(), "package.json"), path.join(fixtureRoot, "package.json"));
  await fs.copyFile(
    path.join(process.cwd(), "package-lock.json"),
    path.join(fixtureRoot, "package-lock.json"),
  );
  await fs.rm(path.join(fixtureRoot, "src/cli.js"));
  await fs.symlink(path.join(fixtureRoot, "src/config.js"), path.join(fixtureRoot, "src/cli.js"));

  await assert.rejects(
    stageCustomerPlugin({ repoRoot: fixtureRoot, stageRoot, installDependencies: false }),
    /Symlink source is not allowed/,
  );
});
