import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { stageCustomerPlugin } from "../../scripts/customer-plugin/stage.js";
import { verifyCustomerPlugin } from "../../scripts/customer-plugin/verify.js";

async function createStagedPackage(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-customer-verify-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return stageCustomerPlugin({ repoRoot: process.cwd(), stageRoot: root, installDependencies: true });
}

test("verifier accepts the sanitized staged plugin", async (t) => {
  const { packageRoot } = await createStagedPackage(t);
  const result = await verifyCustomerPlugin({ packageRoot });

  assert.equal(result.status, "passed");
  assert.equal(result.checks.every((check) => check.status === "passed"), true);
  assert.equal(result.files.includes("marketplace.json"), true);
  assert.equal(result.files.includes("plugins/pixverse-api/.codex-plugin/plugin.json"), true);
});

test("verifier rejects forbidden files without exposing their contents", async (t) => {
  const { packageRoot } = await createStagedPackage(t);
  const secret = ["mh_", "live_secret_value"].join("");
  await fs.writeFile(path.join(packageRoot, ".env"), `PIXVERSE_GROWTH_API_KEY=${secret}\n`);

  let message = "";
  await assert.rejects(
    verifyCustomerPlugin({ packageRoot }),
    (error) => {
      message = error.message;
      return /forbidden path: \.env/.test(error.message);
    },
  );
  assert.doesNotMatch(message, new RegExp(secret));
});

test("verifier rejects symlinks, invalid manifests, and unsafe wrapper modes", async (t) => {
  await t.test("symlink", async (subtest) => {
    const { packageRoot } = await createStagedPackage(subtest);
    await fs.symlink("marketplace.json", path.join(packageRoot, "linked-marketplace.json"));
    await assert.rejects(verifyCustomerPlugin({ packageRoot }), /symlink is not allowed/);
  });

  await t.test("manifest", async (subtest) => {
    const { packageRoot, pluginRoot } = await createStagedPackage(subtest);
    await fs.writeFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "{}\n");
    await assert.rejects(verifyCustomerPlugin({ packageRoot }), /plugin manifest name/);
  });

  await t.test("wrapper mode", async (subtest) => {
    const { packageRoot, pluginRoot } = await createStagedPackage(subtest);
    await fs.chmod(path.join(pluginRoot, "scripts/pixverse-api"), 0o644);
    await assert.rejects(verifyCustomerPlugin({ packageRoot }), /wrapper must be executable/);
  });
});
