import assert from "node:assert/strict";
import test from "node:test";

import { pollUntilTerminal } from "../../src/core/polling.js";

test("pollUntilTerminal uses injected time and sleep and preserves unknown statuses", async () => {
  let nowMs = 0;
  const snapshots = [{ status: 777, marker: "unknown" }, { status: 1, marker: "done" }];
  const seen = [];

  const result = await pollUntilTerminal({
    poll: async () => snapshots.shift(),
    isTerminal: (snapshot) => snapshot.status === 1,
    intervalMs: 250,
    timeoutMs: 1_000,
    now: () => nowMs,
    sleep: async (milliseconds) => { nowMs += milliseconds; },
    onSnapshot: async (snapshot) => seen.push(snapshot),
  });

  assert.deepEqual(seen[0], { status: 777, marker: "unknown" });
  assert.deepEqual(result, { status: 1, marker: "done" });
  assert.equal(nowMs, 250);
});

test("pollUntilTerminal throws a structured timeout with the last snapshot", async () => {
  let nowMs = 0;
  await assert.rejects(
    pollUntilTerminal({
      poll: async () => ({ status: "mystery" }),
      isTerminal: () => false,
      intervalMs: 100,
      timeoutMs: 250,
      now: () => nowMs,
      sleep: async (milliseconds) => { nowMs += milliseconds; },
      provider: "platform",
      operation: "video.poll",
    }),
    (error) => error.category === "timeout"
      && error.provider === "platform"
      && error.details.last_snapshot.status === "mystery",
  );
});

test("pollUntilTerminal validates callbacks and time bounds", async () => {
  await assert.rejects(pollUntilTerminal({ isTerminal: () => true }), /poll must be a function/i);
  await assert.rejects(pollUntilTerminal({ poll: async () => ({}), intervalMs: 0 }), /isTerminal must be a function/i);
  await assert.rejects(
    pollUntilTerminal({ poll: async () => ({}), isTerminal: () => false, intervalMs: 0 }),
    /intervalMs must be a positive number/i,
  );
  await assert.rejects(
    pollUntilTerminal({ poll: async () => ({}), isTerminal: () => false, timeoutMs: -1 }),
    /timeoutMs must be a non-negative number/i,
  );
});
