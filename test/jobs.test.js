import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runVideoJob } from "../src/jobs.js";

test("runVideoJob writes durable job artifacts and returns final output", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-api-job-"));
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-api-job-"));
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

test("runVideoJob can inject a folder_id override into the submitted payload", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-api-job-"));
  const originalPayload = {
    product: { source_url: "https://shop.example.com/products/running-shoes" },
    video: { aspect_ratio: "9:16" },
  };
  const client = {
    async createVideo(receivedPayload) {
      assert.deepEqual(receivedPayload, {
        ...originalPayload,
        folder_id: "630251570268735431",
      });
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
    async pollVideo() {
      throw new Error("pollVideo should not be called");
    },
  };

  const result = await runVideoJob(client, originalPayload, {
    jobsDir: root,
    folderId: "630251570268735431",
    poll: false,
  });
  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));

  assert.equal(request.payload.folder_id, "630251570268735431");
  assert.equal(originalPayload.folder_id, undefined);
});

test("runVideoJob resolves an auto folder before creating the video", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-api-job-"));
  const originalPayload = {
    metadata: { customer: "REVOLVE" },
    product: { source_url: "https://www.revolve.com/item" },
    video: { aspect_ratio: "9:16" },
  };
  const client = {
    async listFolders() {
      return { body: { folders: [{ folder_id: "636771263750078906", name: "REVOLVE" }] } };
    },
    async createFolder() {
      throw new Error("createFolder should not be called");
    },
    async createVideo(receivedPayload) {
      assert.equal(receivedPayload.folder_id, "636771263750078906");
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
    async pollVideo() {
      throw new Error("pollVideo should not be called");
    },
  };

  const result = await runVideoJob(client, originalPayload, {
    jobsDir: root,
    autoFolder: true,
    poll: false,
  });
  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));
  const folder = JSON.parse(await fs.readFile(path.join(result.job_dir, "folder.json"), "utf8"));

  assert.equal(request.payload.folder_id, "636771263750078906");
  assert.equal(result.folder_id, "636771263750078906");
  assert.equal(result.folder_name, "REVOLVE");
  assert.equal(folder.source, "existing-folder");
  assert.equal(originalPayload.folder_id, undefined);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
