import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resumeGrowthStudioJob, runGrowthStudioJob } from "../../src/growth-studio/jobs.js";

test("Growth Studio jobs write private redacted artifacts", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-job-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await runGrowthStudioJob({
    async createVideo() {
      return {
        body: {
          video_id: "627410861853514292",
          status: "processing",
          access_token: "fixture-response-token",
        },
      };
    },
  }, {
    product: { source_url: "https://shop.example.test/item", api_key: "payload-" + "fixture" },
    video: { aspect_ratio: "9:16" },
  }, { jobsDir: root, poll: false, traceId: "fixture-trace" });

  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));
  const created = JSON.parse(await fs.readFile(path.join(result.job_dir, "create-response.json"), "utf8"));
  assert.equal(request.payload.product.api_key, "[REDACTED]");
  assert.equal(created.access_token, "[REDACTED]");
  assert.equal((await fs.stat(result.job_dir)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(result.job_dir, "request.json"))).mode & 0o777, 0o600);
  assert.equal((await fs.readdir(result.job_dir)).some((entry) => entry.endsWith(".tmp")), false);
});

test("Growth Studio resume polls a saved ID and never creates another video", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-resume-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "known-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({ trace_id: "fixture-trace" }));
  await fs.writeFile(path.join(jobDir, "video-id.json"), JSON.stringify({ video_id: "627410861853514292" }));
  await fs.writeFile(path.join(jobDir, "final.json"), JSON.stringify({ status: "processing" }));
  let createCalls = 0;

  const result = await resumeGrowthStudioJob({
    async createVideo() { createCalls += 1; },
    async pollVideo(videoId, options) {
      await options.onSnapshot({ video_id: videoId, status: "succeeded" });
      return { video_id: videoId, status: "succeeded" };
    },
  }, jobDir, { initialDelaySeconds: 0 });

  assert.equal(createCalls, 0);
  assert.equal(result.status, "succeeded");
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(JSON.parse(await fs.readFile(path.join(jobDir, "final-prior-1.json"), "utf8")).status, "processing");
});

test("Growth Studio resume without an ID requires reconciliation without network access", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-resume-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "unknown-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({ trace_id: "fixture-trace" }));
  let accesses = 0;
  const client = new Proxy({}, { get() { accesses += 1; } });

  const result = await resumeGrowthStudioJob(client, jobDir);

  assert.equal(accesses, 0);
  assert.equal(result.status, "reconciliation_required");
  assert.equal(result.retryable, false);
  assert.equal(result.trace_id, "fixture-trace");
});
