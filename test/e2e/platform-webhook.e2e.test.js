import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import test from "node:test";

import { createPlatformWebhookHandler } from "../../src/platform/webhooks.js";

const SIGNING_KEY = "e2e-webhook-key";
const TIMESTAMP = 1_800_000_000;

function headersFor(rawBody, { nonce = "e2e-nonce", signatureBody = rawBody } = {}) {
  const payload = JSON.parse(signatureBody);
  const query = new URLSearchParams(Object.entries(payload).map(([key, value]) => [key, String(value)]));
  const signed = `${TIMESTAMP}\n${nonce}\n${query}`;
  return {
    "Webhook-Timestamp": String(TIMESTAMP),
    "Webhook-Nonce": nonce,
    "Webhook-Signature": createHmac("sha256", SIGNING_KEY).update(signed).digest("base64"),
  };
}

async function startHandler(t, options) {
  const server = http.createServer(createPlatformWebhookHandler({
    secret: SIGNING_KEY,
    now: () => TIMESTAMP,
    ...options,
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test("returns exact plain ok only after verified delivery completes", async (t) => {
  const events = [];
  const rawBody = JSON.stringify({ event: "video.completed", id: "123" });
  const url = await startHandler(t, {
    onDelivery: async (payload, context) => events.push({ payload, context }),
  });
  const response = await fetch(url, { method: "POST", headers: headersFor(rawBody), body: rawBody });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), "ok");
  assert.equal(events.length, 1);
  assert.deepEqual({ ...events[0].payload }, { event: "video.completed", id: "123" });
  assert.deepEqual(events[0].context, {
    timestamp: String(TIMESTAMP),
    nonce: "e2e-nonce",
    signature: headersFor(rawBody)["Webhook-Signature"],
    traceId: undefined,
  });
});

test("rejects invalid signatures and malformed payloads before delivery", async (t) => {
  let mutations = 0;
  const url = await startHandler(t, { onDelivery: async () => { mutations += 1; } });

  const invalidBody = JSON.stringify({ event: "forged" });
  const invalidSignature = await fetch(url, {
    method: "POST", headers: headersFor(invalidBody, { signatureBody: '{"event":"different"}' }), body: invalidBody,
  });
  assert.equal(invalidSignature.status, 401);

  const malformedPayload = await fetch(url, {
    method: "POST", headers: headersFor('{"event":"placeholder"}', { nonce: "malformed" }), body: "{",
  });
  assert.equal(malformedPayload.status, 400);

  const goodBody = JSON.stringify({ event: "ready" });
  const failedDeliveryUrl = await startHandler(t, { onDelivery: async () => { throw new Error(`private ${SIGNING_KEY}`); } });
  const failedDelivery = await fetch(failedDeliveryUrl, {
    method: "POST", headers: headersFor(goodBody, { nonce: "delivery-error" }), body: goodBody,
  });
  assert.equal(failedDelivery.status, 500);
  assert.equal((await failedDelivery.text()).includes(SIGNING_KEY), false);
  assert.equal(mutations, 0);
});

test("rejects replay and non-POST or oversized requests without delivery", async (t) => {
  let deliveries = 0;
  const rawBody = JSON.stringify({ event: "ready" });
  const url = await startHandler(t, { onDelivery: async () => { deliveries += 1; } });
  const options = { method: "POST", headers: headersFor(rawBody), body: rawBody };
  assert.equal((await fetch(url, options)).status, 200);
  assert.equal((await fetch(url, options)).status, 409);
  assert.equal((await fetch(url)).status, 405);

  const oversized = "x".repeat(1_048_577);
  const oversizedResponse = await fetch(url, {
    method: "POST", headers: headersFor('{"event":"large"}', { nonce: "large" }), body: oversized,
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal(deliveries, 1);
});
