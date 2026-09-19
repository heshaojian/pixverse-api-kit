import assert from "node:assert/strict";
import test from "node:test";

import { redact, redactHeaders } from "../../src/core/redaction.js";

test("redact recursively removes case-insensitive credential fields without mutation", () => {
  const frozen = Object.freeze({
    headers: Object.freeze({ "API-KEY": "secret", Authorization: "Bearer secret" }),
    nested: Object.freeze([{ api_key: "secret", token: "secret", SECRET: "secret", safe: "yes" }]),
    id: "42",
  });

  assert.deepEqual(redact(frozen), {
    headers: { "API-KEY": "[REDACTED]", Authorization: "[REDACTED]" },
    nested: [{ api_key: "[REDACTED]", token: "[REDACTED]", SECRET: "[REDACTED]", safe: "yes" }],
    id: "42",
  });
  assert.equal(frozen.headers["API-KEY"], "secret");
});

test("redactHeaders handles Headers and returns a plain object", () => {
  assert.deepEqual(redactHeaders(new Headers({ "api-key": "secret", accept: "application/json" })), {
    accept: "application/json",
    "api-key": "[REDACTED]",
  });
});

test("redact safely handles dates and circular values", () => {
  const source = { created: new Date("2026-09-18T00:00:00Z") };
  source.self = source;
  const result = redact(source);
  assert.notEqual(result.created, source.created);
  assert.equal(result.created.toISOString(), source.created.toISOString());
  assert.equal(result.self, "[Circular]");
});

test("redact covers common prefixed and camel-case credential names", () => {
  assert.deepEqual(redact({
    access_token: "secret",
    refreshToken: "secret",
    client_secret: "secret",
    "x-api-key": "secret",
    bearerToken: "secret",
    password: "secret",
    databasePassword: "secret",
    cookie: "secret",
    "set-cookie": "secret",
  }), {
    access_token: "[REDACTED]",
    refreshToken: "[REDACTED]",
    client_secret: "[REDACTED]",
    "x-api-key": "[REDACTED]",
    bearerToken: "[REDACTED]",
    password: "[REDACTED]",
    databasePassword: "[REDACTED]",
    cookie: "[REDACTED]",
    "set-cookie": "[REDACTED]",
  });
});
