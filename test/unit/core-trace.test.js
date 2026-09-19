import assert from "node:assert/strict";
import test from "node:test";

import { createTraceId } from "../../src/core/trace.js";

test("createTraceId returns a fresh RFC 4122 UUID v4", () => {
  const first = createTraceId();
  const second = createTraceId();
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.match(first, pattern);
  assert.match(second, pattern);
  assert.notEqual(first, second);
});
