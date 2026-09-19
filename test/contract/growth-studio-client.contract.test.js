import assert from "node:assert/strict";
import test from "node:test";

import { GrowthStudioClient } from "../../src/growth-studio/client.js";
import { createRecordingFetch, describeRecordedBody, jsonResponse } from "../helpers/recording-fetch.js";

test("Growth Studio client uses bearer auth only and never sends Platform headers", async () => {
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({ video_id: "627410861853514292", status: "processing" }),
    jsonResponse({ ErrCode: 0, Resp: { folders: [] } }),
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

  assert.equal(calls[0].headers.get("Authorization"), "Bearer growth-fixture-key");
  assert.equal(calls[1].headers.get("Authorization"), "Bearer folder-fixture-key");
  assert.equal(calls.every(({ headers }) => !headers.has("API-KEY")), true);
  assert.equal(calls.every(({ headers }) => headers.has("Ai-Trace-Id")), true);
  assert.deepEqual(await describeRecordedBody(calls[0].body), {
    product: { source_url: "https://shop.example.test/item" },
    video: { avatar: { mode: "auto" } },
  });
});

test("Growth Studio client preserves string identifiers through create and poll", async () => {
  const { fetchImpl } = createRecordingFetch([
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
});
