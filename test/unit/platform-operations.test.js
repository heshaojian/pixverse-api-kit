import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  PLATFORM_OPERATIONS,
  getPlatformOperation,
  matchPlatformCommand,
} from "../../src/platform/operations.js";

const inventory = JSON.parse(fs.readFileSync(
  new URL("../fixtures/platform/official-operation-inventory.json", import.meta.url),
  "utf8",
));

test("Platform catalog matches every independently recorded official operation", () => {
  assert.equal(PLATFORM_OPERATIONS.length, 30);
  assert.deepEqual(
    PLATFORM_OPERATIONS.map((operation) => ({ ...operation, command: [...operation.command] })),
    inventory,
  );
});

test("Platform operation IDs and commands are unique", () => {
  const ids = PLATFORM_OPERATIONS.map(({ id }) => id);
  const commands = PLATFORM_OPERATIONS.map(({ command }) => command.join(" "));

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(commands).size, commands.length);
});

test("every operation and command is immutable", () => {
  assert.equal(Object.isFrozen(PLATFORM_OPERATIONS), true);
  for (const operation of PLATFORM_OPERATIONS) {
    assert.equal(Object.isFrozen(operation), true);
    assert.equal(Object.isFrozen(operation.command), true);
    assert.match(operation.documentationUrl, /^https:\/\/docs\.platform\.pixverse\.ai\//);
    assert.equal(typeof operation.billing, "string");
    assert.equal(typeof operation.asynchronous, "boolean");
  }
});

test("catalog lookup resolves IDs and exact CLI segments", () => {
  const operation = getPlatformOperation("video.multi-transition");
  assert.equal(operation.path, "/openapi/v2/video/multi_transition/generate");
  assert.equal(matchPlatformCommand(["video", "multi-transition"]), operation);
  assert.equal(matchPlatformCommand(["video", "multi-transition", "--payload", "input.json"]), operation);
  assert.equal(getPlatformOperation("unknown.operation"), undefined);
  assert.equal(matchPlatformCommand(["video"]), undefined);
  assert.equal(matchPlatformCommand(["video", "unknown"]), undefined);
});

test("billable classification is explicit instead of inferred from HTTP method", () => {
  assert.equal(getPlatformOperation("account.usage").method, "POST");
  assert.equal(getPlatformOperation("account.usage").billing, "read-only");
  assert.equal(getPlatformOperation("video.text").method, "POST");
  assert.equal(getPlatformOperation("video.text").billing, "billable");
});
