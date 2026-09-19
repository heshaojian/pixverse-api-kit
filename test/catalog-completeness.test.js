import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getPlatformHelp } from "../src/platform/cli.js";
import { PLATFORM_OPERATIONS, getPlatformOperation, matchPlatformCommand } from "../src/platform/operations.js";

const ROOT = process.cwd();
const PLATFORM_SKILL = path.join(ROOT, ".agents/skills/pixverse-platform-api/SKILL.md");
const PLATFORM_OPERATION_REFERENCE = path.join(ROOT, ".agents/skills/pixverse-platform-api/references/operation-catalog.md");
const ROUTER_SKILL = path.join(ROOT, ".agents/skills/pixverse-api/SKILL.md");

test("Platform catalog, fixtures, help, and skill markers cover the independent inventory", async () => {
  const inventory = JSON.parse(await fs.readFile(
    path.join(ROOT, "test/fixtures/platform/official-operation-inventory.json"),
    "utf8",
  ));
  const help = getPlatformHelp();
  const platformSkill = await readOptional(PLATFORM_SKILL);
  const operationReference = await readOptional(PLATFORM_OPERATION_REFERENCE);
  const routerSkill = await readOptional(ROUTER_SKILL);
  const catalogIds = PLATFORM_OPERATIONS.map(({ id }) => id).sort();
  const inventoryIds = inventory.map(({ id }) => id).sort();

  assert.deepEqual(catalogIds, inventoryIds);
  const missing = [];
  if (!routerSkill.includes("pixverse-api platform")) missing.push("router skill platform namespace");
  if (!routerSkill.includes("pixverse-api growth-studio")) missing.push("router skill growth-studio namespace");
  for (const expected of inventory) {
    const operation = getPlatformOperation(expected.id);
    assert.equal(operation.id, expected.id);
    assert.equal(operation.method, expected.method);
    assert.equal(operation.path, expected.path);
    assert.equal(operation.documentationUrl, expected.documentationUrl);
    assert.equal(matchPlatformCommand(operation.command), operation);
    assert.match(help, new RegExp(escapeRegExp(`pixverse-api platform ${operation.command.join(" ")}`)));

    for (const fileName of ["request.json", "success.json", "error.json"]) {
      assert.equal(await exists(path.join(ROOT, "test/fixtures/platform", expected.id, fileName)), true);
    }

    const marker = `operation:${expected.id}`;
    if (!platformSkill.includes(marker)) missing.push(`skill ${marker}`);
    if (!operationReference.includes(marker)) missing.push(`reference ${marker}`);
  }

  assert.deepEqual(missing, []);
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
