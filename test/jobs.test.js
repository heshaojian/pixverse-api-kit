import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runVideoJob } from "../src/jobs.js";

test("runVideoJob writes durable job artifacts and returns final output", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "growth-studio-job-"));
  const payload = {
    product: { source_url: "https://shop.example.com/products/running-shoes" },
    video: { aspect_ratio: "9:16" },
  };
  const client = {
    async createVideo(receivedPayload, options) {
      assert.deepEqual(receivedPayload, payload);
      assert.equal(options.traceId, "trace-123-create");
      return {
        body: {
          video_id: "627410861853514292",
          status: "processing",
          request_id: "create-request",
        },
      };
    },
    async pollVideo(videoId, options) {
      assert.equal(videoId, "627410861853514292");
      assert.equal(options.traceId, "trace-123-poll");
      await options.onSnapshot({ video_id: videoId, status: "processing" });
      await options.onSnapshot({
        video_id: videoId,
        status: "succeeded",
        output: { video_url: "https://media.pixverse.ai/videos/result.mp4" },
        request_id: "final-request",
      });
      return {
        video_id: videoId,
        status: "succeeded",
        output: {
          video_url: "https://media.pixverse.ai/videos/result.mp4",
          thumbnail_url: "https://media.pixverse.ai/videos/result.webp",
        },
        request_id: "final-request",
      };
    },
  };

  const result = await runVideoJob(client, payload, {
    jobsDir: root,
    jobName: "Running Shoes",
    traceId: "trace-123",
    initialDelaySeconds: 0,
  });

  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.status, "succeeded");
  assert.equal(result.video_url, "https://media.pixverse.ai/videos/result.mp4");
  assert.ok(result.job_dir.startsWith(root));

  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));
  const videoId = JSON.parse(await fs.readFile(path.join(result.job_dir, "video-id.json"), "utf8"));
  const final = JSON.parse(await fs.readFile(path.join(result.job_dir, "final.json"), "utf8"));
  const pollingLines = (await fs.readFile(path.join(result.job_dir, "polling.jsonl"), "utf8")).trim().split("\n");

  assert.deepEqual(request.payload, payload);
  assert.deepEqual(videoId, { video_id: "627410861853514292" });
  assert.equal(final.status, "succeeded");
  assert.equal(pollingLines.length, 2);
});

test("runVideoJob can save create result without polling", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "growth-studio-job-"));
  const client = {
    async createVideo() {
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
    async pollVideo() {
      throw new Error("pollVideo should not be called");
    },
  };

  const result = await runVideoJob(client, {
    product: { source_url: "https://shop.example.com/products/running-shoes" },
    video: { aspect_ratio: "9:16" },
  }, {
    jobsDir: root,
    poll: false,
  });

  assert.equal(result.status, "processing");
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(await fileExists(path.join(result.job_dir, "polling.jsonl")), false);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
