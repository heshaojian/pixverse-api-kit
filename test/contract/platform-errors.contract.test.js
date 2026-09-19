import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { PlatformClient } from "../../src/platform/client.js";
import { PLATFORM_OPERATIONS } from "../../src/platform/operations.js";
import { createRecordingFetch, jsonResponse } from "../helpers/recording-fetch.js";

const FIXTURES = new URL("../fixtures/platform/", import.meta.url);
const TEST_CREDENTIAL = ["fixture", "credential"].join("-");

for (const operation of PLATFORM_OPERATIONS) {
  test(`${operation.id} maps its independent provider error envelope`, async () => {
    const requestFixture = await fixture(operation.id, "request");
    const errorFixture = await fixture(operation.id, "error");
    const recorder = createRecordingFetch([jsonResponse(errorFixture.responseText, {
      status: errorFixture.httpStatus,
    })]);
    const client = new PlatformClient({
      apiKey: TEST_CREDENTIAL,
      baseUrl: "https://platform.example.test",
      fetchImpl: recorder.fetchImpl,
    });

    await assert.rejects(
      client.execute(operation.id, requestFixture.input),
      (error) => {
        assert.equal(error.name, "PixverseCliError");
        assert.equal(error.category, "provider");
        assert.equal(error.provider, "platform");
        assert.equal(error.operation, operation.id);
        assert.equal(error.status, errorFixture.httpStatus);
        assert.equal(error.code, errorFixture.expected.code);
        assert.equal(error.message, errorFixture.expected.message);
        assert.equal(error.retryable, false);
        assert.match(error.traceId, /^[0-9a-f-]{36}$/i);
        assert.deepEqual(toPlainJson(error.details), errorFixture.expected.details);
        return true;
      },
    );
    assert.equal(recorder.calls.length, 1);
  });
}

test("recovery mode rejects a missing or invalid saved trace before fetch", async () => {
  const recorder = createRecordingFetch();
  const client = new PlatformClient({
    apiKey: TEST_CREDENTIAL,
    baseUrl: "https://platform.example.test",
    fetchImpl: recorder.fetchImpl,
  });

  for (const traceId of [undefined, "", "not-a-uuid"]) {
    await assert.rejects(
      client.execute("account.balance", {}, { recovery: true, traceId }),
      (error) => error.category === "validation" && error.code === "INVALID_RECOVERY_TRACE",
    );
  }
  assert.equal(recorder.calls.length, 0);
});

test("unknown operations and invalid envelopes fail before returning data", async () => {
  const recorder = createRecordingFetch([jsonResponse('{"ok":true}')]);
  const client = new PlatformClient({
    apiKey: TEST_CREDENTIAL,
    baseUrl: "https://platform.example.test",
    fetchImpl: recorder.fetchImpl,
  });

  await assert.rejects(client.execute("unknown.operation", {}), (error) => (
    error.category === "validation" && error.code === "UNKNOWN_PLATFORM_OPERATION"
  ));
  await assert.rejects(client.execute("account.balance", {}), (error) => error.category === "response");
  assert.equal(recorder.calls.length, 1);
});

test("read-only POST operations are not retried because only GET and HEAD are retry-safe", async () => {
  const recorder = createRecordingFetch([
    jsonResponse('{"error":{"message":"busy"}}', { status: 503 }),
    jsonResponse('{"ErrCode":0,"ErrMsg":"success","Resp":{}}'),
  ]);
  const client = new PlatformClient({
    apiKey: TEST_CREDENTIAL,
    baseUrl: "https://platform.example.test",
    fetchImpl: recorder.fetchImpl,
    sleep: async () => {},
  });

  await assert.rejects(client.execute("account.usage", {}), (error) => error.status === 503);
  assert.equal(recorder.calls.length, 1);
});

test("non-envelope HTTP errors retain the HTTP classification", async () => {
  const recorder = createRecordingFetch([jsonResponse({
    error: { code: "BAD_REQUEST", message: "Invalid request" },
  }, { status: 400 })]);
  const client = new PlatformClient({
    apiKey: TEST_CREDENTIAL,
    baseUrl: "https://platform.example.test",
    fetchImpl: recorder.fetchImpl,
  });

  await assert.rejects(client.execute("account.balance", {}), (error) => (
    error.category === "http"
    && error.code === "BAD_REQUEST"
    && error.status === 400
    && error.provider === "platform"
  ));
});

async function fixture(operationId, name) {
  return JSON.parse(await fs.readFile(new URL(`${operationId}/${name}.json`, FIXTURES), "utf8"));
}

function toPlainJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
