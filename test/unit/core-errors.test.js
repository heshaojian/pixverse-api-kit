import assert from "node:assert/strict";
import test from "node:test";

import { PixverseCliError, serializeError } from "../../src/core/errors.js";

test("PixverseCliError and serialization expose stable redacted public fields", () => {
  const error = new PixverseCliError("Request failed", {
    category: "http",
    provider: "platform",
    operation: "video.create",
    status: 429,
    code: "RATE_LIMITED",
    retryable: true,
    retryAfter: 12,
    traceId: "trace-1",
    details: { "API-KEY": "top-secret", video_id: "42" },
  });

  assert.deepEqual(serializeError(error), {
    name: "PixverseCliError",
    message: "Request failed",
    category: "http",
    provider: "platform",
    operation: "video.create",
    status: 429,
    code: "RATE_LIMITED",
    retryable: true,
    retry_after: 12,
    trace_id: "trace-1",
    details: { "API-KEY": "[REDACTED]", video_id: "42" },
  });
  assert.doesNotMatch(JSON.stringify(serializeError(error)), /top-secret/);
});

test("serializeError accepts ordinary errors without unstable stack output", () => {
  assert.deepEqual(serializeError(new Error("boom")), {
    name: "Error",
    message: "boom",
  });
});

test("PixverseCliError also accepts a single options object", () => {
  const error = new PixverseCliError({ message: "Invalid input", category: "validation", code: "BAD_INPUT" });
  assert.deepEqual(serializeError(error), {
    name: "PixverseCliError",
    message: "Invalid input",
    category: "validation",
    code: "BAD_INPUT",
  });
});
