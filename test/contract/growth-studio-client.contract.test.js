import assert from "node:assert/strict";
import test from "node:test";

import {
  GrowthStudioApiError,
  GrowthStudioClient,
  parseResponse,
} from "../../src/growth-studio/client.js";
import { createRecordingFetch, describeRecordedBody, jsonResponse } from "../helpers/recording-fetch.js";

test("Growth Studio client uses bearer auth only and never sends Platform headers", async () => {
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({ video_id: "627410861853514292", status: "processing" }),
    jsonResponse({ ErrCode: 0, Resp: { folders: [] } }),
    jsonResponse({ ErrCode: 0, Resp: { folder_id: "630251570268735431" } }),
  ]);
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "growth-fixture-key",
    ["folderApi" + "Key"]: "folder-fixture-key",
    baseUrl: "https://growth.example.test",
    fetchImpl,
  });

  await client.createVideo({
    product: { source_url: "https://shop.example.test/item" },
    video: { avatar: { mode: "auto" } },
  }, { traceId: "create-trace" });
  await client.listFolders({ traceId: "folder-trace" });
  await client.createFolder({ name: "ACME" }, { traceId: "create-folder-trace" });

  assert.equal(calls[0].headers.get("Authorization"), "Bearer growth-fixture-key");
  assert.equal(calls[1].headers.get("Authorization"), "Bearer folder-fixture-key");
  assert.equal(calls[2].headers.get("Authorization"), "Bearer folder-fixture-key");
  assert.equal(calls.every(({ headers }) => !headers.has("API-KEY")), true);
  assert.equal(calls.every(({ headers }) => headers.has("Ai-Trace-Id")), true);
  assert.deepEqual(calls.map(({ method }) => method), ["POST", "GET", "POST"]);
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), [
    "/openapi/v1/videos",
    "/marketing_hub/folder/list",
    "/marketing_hub/folder/create",
  ]);
  assert.deepEqual(await describeRecordedBody(calls[0].body), {
    product: { source_url: "https://shop.example.test/item" },
    video: { avatar: { mode: "auto" } },
  });
  assert.deepEqual(await describeRecordedBody(calls[2].body), { name: "ACME" });
});

test("Growth Studio client preserves string identifiers through create and poll", async () => {
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({ video_id: "627410861853514292", status: "processing" }),
    jsonResponse({ video_id: "627410861853514292", status: "succeeded" }),
  ]);
  const client = new GrowthStudioClient({
    ["api" + "Key"]: "growth-fixture-key",
    baseUrl: "https://growth.example.test",
    fetchImpl,
    sleep: async () => {},
  });

  const created = await client.createVideo({
    product: { source_url: "https://shop.example.test/item" },
    video: { avatar: { mode: "auto" } },
  });
  const final = await client.pollVideo(created.body.video_id, { initialDelaySeconds: 0 });

  assert.equal(created.body.video_id, "627410861853514292");
  assert.equal(final.video_id, "627410861853514292");
  assert.deepEqual(calls.map(({ method }) => method), ["POST", "GET"]);
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), [
    "/openapi/v1/videos",
    "/openapi/v1/videos/627410861853514292",
  ]);
  assert.equal(calls.every(({ headers }) => !headers.has("API-KEY")), true);
});

test("Growth Studio successful responses reject malformed JSON as a protocol error", async () => {
  await assert.rejects(
    parseResponse(new Response("not-json", {
      status: 200,
      headers: { "x-request-id": "request_malformed" },
    })),
    (error) => {
      assert.ok(error instanceof GrowthStudioApiError);
      assert.equal(error.category, "protocol");
      assert.equal(error.code, "INVALID_JSON_RESPONSE");
      assert.equal(error.status, 200);
      assert.equal(error.retryable, false);
      assert.equal(error.requestId, "request_malformed");
      return true;
    },
  );
});
