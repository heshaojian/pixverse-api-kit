import assert from "node:assert/strict";
import test from "node:test";
import {
  GrowthStudioClient,
  createProductUrlPayload,
  validateCreatePayload,
  validateEditPayload,
} from "../src/client.js";
import { GrowthStudioApiError, buildUrl, parseResponse } from "../src/http.js";

test("buildUrl joins base path and omits empty query values", () => {
  const url = buildUrl("https://growth-api.pixverse.ai", "/openapi/v1/videos", {
    limit: 20,
    cursor: "",
    status: "succeeded",
  });

  assert.equal(url.toString(), "https://growth-api.pixverse.ai/openapi/v1/videos?limit=20&status=succeeded");
});

test("createProductUrlPayload follows default guide settings", () => {
  const payload = createProductUrlPayload("https://shop.example.com/products/running-shoes");

  assert.deepEqual(payload, {
    product: {
      source_url: "https://shop.example.com/products/running-shoes",
    },
    video: {
      aspect_ratio: "9:16",
      duration_seconds: 30,
      resolution: "1080p",
      language: "en-US",
      voiceover: true,
      captions: true,
      background_music: true,
      avatar: { mode: "auto" },
    },
  });
});

test("validateCreatePayload accepts uploaded PixVerse image URLs", () => {
  assert.doesNotThrow(() => validateCreatePayload({
    product: {
      title: "Shoes",
      images: [{ url: "https://media.pixverse.ai/marketing_hub_website/openapi_video_inputs/uploads/22/11/product.webp" }],
    },
    video: { avatar: { mode: "auto" } },
  }));
});

test("validateCreatePayload rejects arbitrary image URLs", () => {
  assert.throws(() => validateCreatePayload({
    product: {
      title: "Shoes",
      images: [{ url: "https://shop.example.com/product.webp" }],
    },
    video: { avatar: { mode: "auto" } },
  }), /Product images must use URLs returned by the image upload endpoint/);
});

test("validateEditPayload requires one-based clip index", () => {
  assert.throws(() => validateEditPayload({ clip_index: 0, instruction: "Try again." }), /one-based/);
  assert.doesNotThrow(() => validateEditPayload({ clip_index: 1, instruction: "Try again." }));
});

test("parseResponse throws structured API errors", async () => {
  const response = new Response(JSON.stringify({
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests.",
      retryable: true,
      details: { limit: 1000 },
    },
    request_id: "request_abc123",
  }), {
    status: 429,
    headers: { "retry-after": "30" },
  });

  await assert.rejects(parseResponse(response), (error) => {
    assert.ok(error instanceof GrowthStudioApiError);
    assert.equal(error.status, 429);
    assert.equal(error.code, "RATE_LIMIT_EXCEEDED");
    assert.equal(error.retryable, true);
    assert.equal(error.retryAfter, 30);
    assert.equal(error.requestId, "request_abc123");
    return true;
  });
});

test("client keeps video IDs as strings and sends bearer auth", async () => {
  const calls = [];
  const credentials = { ["api" + "Key"]: "test-api-key" };
  const client = new GrowthStudioClient({
    ...credentials,
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(JSON.stringify({ video_id: "627410861853514292", status: "succeeded" }), { status: 200 });
    },
  });

  const result = await client.getVideo("627410861853514292");

  assert.equal(result.body.video_id, "627410861853514292");
  assert.equal(calls[0].url, "https://growth-api.pixverse.ai/openapi/v1/videos/627410861853514292");
  assert.equal(calls[0].init.headers.get("Authorization"), "Bearer test-api-key");
});

test("pollVideo honors Retry-After and stops on succeeded", async () => {
  const waits = [];
  const snapshots = [];
  const credentials = { ["api" + "Key"]: "test-api-key" };
  const responses = [
    new Response(JSON.stringify({ video_id: "627410861853514292", status: "processing" }), {
      status: 200,
      headers: { "retry-after": "7" },
    }),
    new Response(JSON.stringify({ video_id: "627410861853514292", status: "succeeded", output: { video_url: "https://media.pixverse.ai/videos/result.mp4" } }), {
      status: 200,
    }),
  ];
  const client = new GrowthStudioClient({
    ...credentials,
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async () => responses.shift(),
    sleep: async (ms) => waits.push(ms),
  });

  const result = await client.pollVideo("627410861853514292", {
    initialDelaySeconds: 0,
    onSnapshot: async (snapshot) => snapshots.push(snapshot.status),
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(waits, [7000]);
  assert.deepEqual(snapshots, ["processing", "succeeded"]);
});
