import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runGrowthStudioCommand } from "../../src/growth-studio/cli.js";

test("namespaced Growth Studio create, poll, and folder job flow stay offline", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-e2e-"));
  const payloadPath = path.join(tempRoot, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    product: { source_url: "https://shop.example.test/item" },
    video: { avatar: { mode: "auto" } },
  }));
  const calls = [];
  const client = {
    async createVideo(payload, options) {
      calls.push(["create", payload, options.traceId]);
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
    async pollVideo(videoId, options) {
      calls.push(["poll", videoId, options.traceId]);
      await options.onSnapshot?.({ video_id: videoId, status: "succeeded" });
      return { video_id: videoId, status: "succeeded", output: { video_url: "https://media.pixverse.ai/final.mp4" } };
    },
  };

  const result = await runGrowthStudioCommand([
    "run-job",
    "--payload",
    payloadPath,
    "--folder-id",
    "630251570268735431",
    "--jobs-dir",
    path.join(tempRoot, "jobs"),
  ], { client });

  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls.map(([name]) => name), ["create", "poll"]);
  assert.equal(calls[0][1].folder_id, "630251570268735431");
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(result.job_dir, "video-id.json"), "utf8")), {
    video_id: "627410861853514292",
  });
});
