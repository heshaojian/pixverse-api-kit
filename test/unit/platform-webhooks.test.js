import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createMemoryNonceStore,
  createPlatformWebhookHandler,
  parsePlatformWebhook,
  verifyPlatformWebhook,
} from "../../src/platform/webhooks.js";

const SIGNING_KEY = "unit-test-webhook-key";
const TIMESTAMP = 1_800_000_000;
const RAW_BODY = JSON.stringify({ event: "video.completed", video_id: "9007199254740993123" });

function signedHeaders(rawBody = RAW_BODY, overrides = {}) {
  const timestamp = String(overrides.timestamp ?? TIMESTAMP);
  const nonce = overrides.nonce ?? "nonce-1";
  const signingKey = overrides.signingKey ?? SIGNING_KEY;
  const signed = `${timestamp}\n${nonce}\n${encodeURIComponent(rawBody)}`;
  return {
    "Webhook-Timestamp": timestamp,
    "Webhook-Nonce": nonce,
    "Webhook-Signature": createHmac("sha256", signingKey).update(signed).digest("base64"),
    "Ai-Trace-Id": "trace-1",
  };
}

test("verifies the documented Base64 HMAC-SHA256 formula and normalizes header case", async () => {
  const headers = signedHeaders();
  const result = await verifyPlatformWebhook({
    rawBody: RAW_BODY,
    headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
    secret: SIGNING_KEY,
    now: () => TIMESTAMP,
    nonceStore: createMemoryNonceStore(),
  });
  assert.deepEqual(result, {
    timestamp: String(TIMESTAMP),
    nonce: "nonce-1",
    signature: headers["Webhook-Signature"],
    traceId: "trace-1",
  });
});

for (const [name, configure] of [
  ["altered payload field", () => ({
    rawBody: JSON.stringify({ event: "video.failed", video_id: "9007199254740993123" }),
    headers: signedHeaders(),
  })],
  ["wrong signing key", () => ({ rawBody: RAW_BODY, headers: signedHeaders(RAW_BODY, { signingKey: "other" }) })],
  ["missing required header", () => {
    const headers = signedHeaders();
    delete headers["Webhook-Nonce"];
    return { rawBody: RAW_BODY, headers };
  }],
  ["duplicate differently-cased header", () => ({
    rawBody: RAW_BODY,
    headers: { ...signedHeaders(), "webhook-nonce": "nonce-2" },
  })],
  ["duplicate raw header", () => {
    const headers = signedHeaders();
    return {
      rawBody: RAW_BODY,
      headers: Object.entries(headers).flatMap(([key, value]) => [key, value]).concat(["Webhook-Nonce", "again"]),
    };
  }],
  ["non-string raw body", () => ({ rawBody: {}, headers: signedHeaders() })],
  ["oversized raw body", () => {
    const rawBody = "x".repeat(1_048_577);
    return { rawBody, headers: signedHeaders(rawBody) };
  }],
  ["oversized nonce", () => ({ rawBody: RAW_BODY, headers: signedHeaders(RAW_BODY, { nonce: "n".repeat(257) }) })],
]) {
  test(`rejects ${name}`, async () => {
    const input = configure();
    await assert.rejects(verifyPlatformWebhook({
      ...input,
      secret: SIGNING_KEY,
      now: () => TIMESTAMP,
      nonceStore: createMemoryNonceStore(),
    }), (error) => error.code && !error.message.includes(SIGNING_KEY));
  });
}

for (const [name, timestamp] of [["stale", TIMESTAMP - 301], ["future", TIMESTAMP + 301]]) {
  test(`rejects a ${name} timestamp`, async () => {
    await assert.rejects(verifyPlatformWebhook({
      rawBody: RAW_BODY,
      headers: signedHeaders(RAW_BODY, { timestamp }),
      secret: SIGNING_KEY,
      now: () => TIMESTAMP,
      nonceStore: createMemoryNonceStore(),
    }), (error) => error.code === "WEBHOOK_TIMESTAMP_OUT_OF_RANGE");
  });
}

test("rejects nonce replay, including concurrent verification", async () => {
  const nonceStore = createMemoryNonceStore();
  const attempt = () => verifyPlatformWebhook({
    rawBody: RAW_BODY, headers: signedHeaders(), secret: SIGNING_KEY, now: () => TIMESTAMP, nonceStore,
  });
  const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason.code === "WEBHOOK_REPLAY").length, 2);
});

test("bounds and expires the in-memory nonce store", () => {
  const store = createMemoryNonceStore({ maxEntries: 1 });
  assert.equal(store.consume("old", TIMESTAMP + 1, TIMESTAMP), true);
  assert.throws(
    () => store.consume("blocked", TIMESTAMP + 2, TIMESTAMP),
    (error) => error.code === "WEBHOOK_NONCE_STORE_FULL",
  );
  assert.equal(store.consume("new", TIMESTAMP + 3, TIMESTAMP + 2), true);
});

test("supports byte bodies, Headers, Date clocks, and Set replay stores", async () => {
  const nonceStore = new Set();
  const input = {
    rawBody: Buffer.from(RAW_BODY),
    headers: new Headers(signedHeaders()),
    secret: SIGNING_KEY,
    now: () => new Date(TIMESTAMP * 1_000),
    nonceStore,
  };
  assert.equal((await verifyPlatformWebhook(input)).nonce, "nonce-1");
  await assert.rejects(verifyPlatformWebhook(input), (error) => error.code === "WEBHOOK_REPLAY");
});

test("fails closed for invalid replay, clock, and header inputs", async () => {
  const base = { rawBody: RAW_BODY, secret: SIGNING_KEY, now: () => TIMESTAMP };
  await assert.rejects(
    verifyPlatformWebhook({ ...base, headers: signedHeaders(), nonceStore: {} }),
    (error) => error.code === "WEBHOOK_NONCE_STORE_INVALID",
  );
  await assert.rejects(
    verifyPlatformWebhook({ ...base, headers: signedHeaders(), now: () => Number.NaN, nonceStore: new Set() }),
    (error) => error.code === "WEBHOOK_CONFIGURATION_INVALID",
  );
  await assert.rejects(
    verifyPlatformWebhook({ ...base, headers: null, nonceStore: new Set() }),
    (error) => error.code === "WEBHOOK_HEADER_MISSING",
  );
  await assert.rejects(
    verifyPlatformWebhook({ ...base, headers: ["Webhook-Timestamp"], nonceStore: new Set() }),
    (error) => error.code === "WEBHOOK_HEADER_INVALID",
  );
  await assert.rejects(
    verifyPlatformWebhook({
      ...base,
      headers: { ...signedHeaders(), "Ai-Trace-Id": "x".repeat(257) },
      nonceStore: new Set(),
    }),
    (error) => error.code === "WEBHOOK_HEADER_INVALID",
  );
});

test("uses a timing-safe comparison with malformed signatures rejected uniformly", async () => {
  for (const signature of ["not-base64", "YQ==", "A".repeat(44)]) {
    await assert.rejects(verifyPlatformWebhook({
      rawBody: RAW_BODY,
      headers: { ...signedHeaders(), "Webhook-Signature": signature },
      secret: SIGNING_KEY,
      now: () => TIMESTAMP,
      nonceStore: createMemoryNonceStore(),
    }), (error) => error.code === "WEBHOOK_SIGNATURE_INVALID" && !error.message.includes(signature));
  }
});

test("parses valid JSON without losing large integer identifiers", () => {
  const parsed = parsePlatformWebhook('{"video_id":9007199254740993123}');
  assert.equal(parsed.video_id, "9007199254740993123");
});

test("returns ordinary plain objects and rejects prototype-pollution keys", () => {
  const parsed = parsePlatformWebhook('{"delivery":{"status":"ready","items":[{"id":1}]}}');
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal(Object.getPrototypeOf(parsed.delivery), Object.prototype);
  assert.equal(Object.getPrototypeOf(parsed.delivery.items[0]), Object.prototype);
  assert.throws(
    () => parsePlatformWebhook('{"__proto__":{"polluted":true}}'),
    (error) => error.code === "WEBHOOK_PAYLOAD_INVALID",
  );
  assert.equal({}.polluted, undefined);
});

test("requires safe handler configuration", () => {
  assert.throws(
    () => createPlatformWebhookHandler({ secret: "", onDelivery: async () => {} }),
    (error) => error.code === "WEBHOOK_CONFIGURATION_INVALID",
  );
  assert.throws(
    () => createPlatformWebhookHandler({ secret: SIGNING_KEY }),
    (error) => error.code === "WEBHOOK_CONFIGURATION_INVALID",
  );
});

test("rejects malformed and non-object payloads", () => {
  for (const rawBody of ["{", "null", "[]", "\"string\""]) {
    assert.throws(() => parsePlatformWebhook(rawBody), (error) => error.code === "WEBHOOK_PAYLOAD_INVALID");
  }
});
