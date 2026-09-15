import assert from "node:assert/strict";
import test from "node:test";
import {
  GrowthStudioClient,
  createProductUrlPayload,
  validateCreatePayload,
  validateEditPayload,
  validateFolderPayload,
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

test("createProductUrlPayload can target a Growth Studio folder", () => {
  const payload = createProductUrlPayload("https://shop.example.com/products/running-shoes", {
    folderId: "630251570268735431",
  });

  assert.equal(payload.folder_id, "630251570268735431");
});

test("validateCreatePayload requires folder_id to stay a numeric string", () => {
  assert.doesNotThrow(() => validateCreatePayload({
    folder_id: "630251570268735431",
    product: { source_url: "https://shop.example.com/products/running-shoes" },
    video: { avatar: { mode: "auto" } },
  }));
  assert.throws(() => validateCreatePayload({
    folder_id: 630251570268735431,
    product: { source_url: "https://shop.example.com/products/running-shoes" },
    video: { avatar: { mode: "auto" } },
  }), /folder_id must be a numeric string/);
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

test("client lists and creates folders through Growth Studio folder endpoints", async () => {
  const calls = [];
  const credentials = { ["api" + "Key"]: "test-api-key" };
  const responses = [
    new Response(JSON.stringify({ ErrCode: 0, Resp: { folders: [{ folder_id: "636771263750078906", name: "REVOLVE" }] } }), { status: 200 }),
    new Response(JSON.stringify({ ErrCode: 0, Resp: { folder_id: "636771263750078906" } }), { status: 200 }),
  ];
  const client = new GrowthStudioClient({
    ...credentials,
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return responses.shift();
    },
  });

  const listResult = await client.listFolders();
  const createResult = await client.createFolder({ name: "REVOLVE" });

  assert.deepEqual(listResult.body.folders, [{ folder_id: "636771263750078906", name: "REVOLVE" }]);
  assert.deepEqual(createResult.body, { folder_id: "636771263750078906" });
  assert.equal(calls[0].url, "https://growth-api.pixverse.ai/marketing_hub/folder/list");
  assert.equal(calls[1].url, "https://growth-api.pixverse.ai/marketing_hub/folder/create");
  assert.equal(calls[1].init.headers.get("Authorization"), "Bearer test-api-key");
  assert.equal(calls[1].init.body, JSON.stringify({ name: "REVOLVE" }));
});

test("client can point folder commands at a configured Growth Studio API prefix", async () => {
  const calls = [];
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "test-api-key",
    folderApiPrefix: "/openapi/v1/growth-studio",
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(JSON.stringify({ folders: [] }), { status: 200 });
    },
  });

  await client.listFolders();

  assert.equal(calls[0].url, "https://growth-api.pixverse.ai/openapi/v1/growth-studio/folder/list");
});

test("client can use a separate folder API token for folder endpoints", async () => {
  const calls = [];
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "video-api-key",
    folderApiKey: "folder-api-key",
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(JSON.stringify({ ErrCode: 0, Resp: { folders: [] } }), { status: 200 });
    },
  });

  await client.listFolders();

  assert.equal(calls[0].init.headers.get("Authorization"), "Bearer folder-api-key");
});

test("client rejects Marketing Hub folder envelope errors", async () => {
  const credentials = { ["api" + "Key"]: "test-api-key" };
  const client = new GrowthStudioClient({
    ...credentials,
    baseUrl: "https://growth-api.pixverse.ai",
    fetchImpl: async () => new Response(JSON.stringify({ ErrCode: 10001, ErrMsg: "Token is invalid", Resp: {} }), { status: 200 }),
  });

  await assert.rejects(client.listFolders(), /Token is invalid/);
});

test("validateFolderPayload requires a folder name", () => {
  assert.doesNotThrow(() => validateFolderPayload({ name: "REVOLVE" }));
  assert.throws(() => validateFolderPayload({ name: "" }), /non-empty name/);
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
