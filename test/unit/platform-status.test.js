import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlatformStatus } from "../../src/platform/status.js";

test("normalizePlatformStatus maps every documented status", () => {
  assert.deepEqual(normalizePlatformStatus(1), { status: "succeeded", rawStatus: 1, terminal: true });
  assert.deepEqual(normalizePlatformStatus(5), { status: "processing", rawStatus: 5, terminal: false });
  assert.deepEqual(normalizePlatformStatus(6), { status: "deleted", rawStatus: 6, terminal: true });
  assert.deepEqual(normalizePlatformStatus(7), { status: "moderation_failed", rawStatus: 7, terminal: true });
  assert.deepEqual(normalizePlatformStatus(8), { status: "failed", rawStatus: 8, terminal: true });
});

test("normalizePlatformStatus retains unknown raw values without treating them as terminal", () => {
  assert.deepEqual(normalizePlatformStatus(777), {
    status: "unknown",
    rawStatus: 777,
    terminal: false,
  });
  assert.deepEqual(normalizePlatformStatus("future"), {
    status: "unknown",
    rawStatus: "future",
    terminal: false,
  });
});
