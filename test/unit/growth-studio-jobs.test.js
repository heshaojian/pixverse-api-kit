import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resumeGrowthStudioJob,
  runGrowthStudioJob,
  runPdpJob,
} from "../../src/growth-studio/jobs.js";

function validPdpPayload() {
  return {
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "pro", duration: 10 },
  };
}

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
  assert.equal(request.workflow, undefined);
  assert.equal(request.endpoint, undefined);
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

test("Growth Studio resume preserves an earlier error when polling fails again", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-resume-error-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "failed-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({ trace_id: "fixture-trace" }));
  await fs.writeFile(path.join(jobDir, "video-id.json"), JSON.stringify({ video_id: "627410861853514292" }));
  await fs.writeFile(path.join(jobDir, "error.json"), JSON.stringify({
    message: "Earlier safe failure",
    trace_id: "fixture-trace",
  }));

  await assert.rejects(
    resumeGrowthStudioJob({
      async pollVideo() {
        throw new TypeError("fixture transport detail that must not persist");
      },
    }, jobDir, { initialDelaySeconds: 0 }),
    /fixture transport detail/,
  );

  const prior = JSON.parse(await fs.readFile(path.join(jobDir, "error-prior-1.json"), "utf8"));
  const current = JSON.parse(await fs.readFile(path.join(jobDir, "error.json"), "utf8"));
  assert.equal(prior.message, "Earlier safe failure");
  assert.equal(current.message, "Growth Studio job failed. Inspect saved artifacts before recovery.");
  assert.equal(current.category, "transport");
  assert.doesNotMatch(JSON.stringify(current), /fixture transport detail/);
});

test("PDP jobs submit once and persist exact wire and reconciliation identifiers", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-job-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let submissions = 0;
  const publicPayload = validPdpPayload();

  const result = await runPdpJob({
    async createPdpVideo(received, options) {
      submissions += 1;
      assert.deepEqual(received, publicPayload);
      assert.equal(options.traceId, "pdp-fixture-create");
      return {
        body: {
          video_id: "627410861853514292",
          ledger_source_id: "627410861853514292",
          status: "processing",
        },
      };
    },
  }, publicPayload, {
    jobsDir: root,
    poll: false,
    traceId: "pdp-fixture",
  });

  const request = JSON.parse(await fs.readFile(path.join(result.job_dir, "request.json"), "utf8"));
  const ledger = JSON.parse(await fs.readFile(path.join(result.job_dir, "ledger-source-id.json"), "utf8"));
  const entries = await fs.readdir(result.job_dir);
  assert.equal(submissions, 1);
  assert.deepEqual(request, {
    provider: "growth-studio",
    workflow: "pdp",
    endpoint: "/openapi/v1/ka/videos",
    trace_id: "pdp-fixture",
    created_at: request.created_at,
    payload: {
      type: "ecommerce_fashion_pdp",
      product: {
        title: "Linen Summer Shirt",
        images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
      },
      video: { mode: "pro", duration: 10 },
    },
  });
  assert.deepEqual(ledger, { ledger_source_id: "627410861853514292" });
  assert.equal(entries.includes("folder.json"), false);
  assert.equal(result.workflow, "pdp");
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.ledger_source_id, "627410861853514292");
});

test("PDP jobs poll the saved ID and persist snapshots and terminal output", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-poll-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let submissions = 0;

  const result = await runPdpJob({
    async createPdpVideo() {
      submissions += 1;
      return {
        body: {
          video_id: "627410861853514292",
          ledger_source_id: "627410861853514293",
          status: "processing",
        },
      };
    },
    async pollVideo(videoId, options) {
      assert.equal(videoId, "627410861853514292");
      assert.equal(options.traceId, "pdp-poll-poll");
      await options.onSnapshot({ video_id: videoId, status: "processing" });
      await options.onSnapshot({ video_id: videoId, status: "succeeded" });
      return {
        video_id: videoId,
        status: "succeeded",
        output: { video_url: "https://media.pixverse.ai/example/result.mp4" },
      };
    },
  }, validPdpPayload(), {
    jobsDir: root,
    traceId: "pdp-poll",
    initialDelaySeconds: 0,
  });

  const final = JSON.parse(await fs.readFile(path.join(result.job_dir, "final.json"), "utf8"));
  const snapshots = (await fs.readFile(path.join(result.job_dir, "polling.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(submissions, 1);
  assert.deepEqual(snapshots.map(({ status }) => status), ["processing", "succeeded"]);
  assert.equal(final.status, "succeeded");
  assert.equal(result.status, "succeeded");
  assert.equal(result.workflow, "pdp");
  assert.equal(result.ledger_source_id, "627410861853514293");
});

test("PDP resume checks workflow then polls without touching a create path", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-resume-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "known-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({
    workflow: "pdp",
    trace_id: "pdp-resume",
  }));
  await fs.writeFile(path.join(jobDir, "video-id.json"), JSON.stringify({
    video_id: "627410861853514292",
  }));
  await fs.writeFile(path.join(jobDir, "ledger-source-id.json"), JSON.stringify({
    ledger_source_id: "627410861853514293",
  }));
  let pollCalls = 0;
  const client = {
    get createPdpVideo() {
      throw new Error("resume must not access createPdpVideo");
    },
    async pollVideo(videoId, options) {
      pollCalls += 1;
      await options.onSnapshot({ video_id: videoId, status: "succeeded" });
      return { video_id: videoId, status: "succeeded" };
    },
  };

  const result = await resumeGrowthStudioJob(client, jobDir, {
    expectedWorkflow: "pdp",
    initialDelaySeconds: 0,
  });

  assert.equal(pollCalls, 1);
  assert.equal(result.workflow, "pdp");
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.ledger_source_id, "627410861853514293");
  assert.equal(result.status, "succeeded");
});

test("PDP resume without an ID requires reconciliation with zero client access", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-reconcile-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "unknown-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({
    workflow: "pdp",
    trace_id: "pdp-reconcile",
  }));
  await fs.writeFile(path.join(jobDir, "ledger-source-id.json"), JSON.stringify({
    ledger_source_id: "627410861853514293",
  }));
  let accesses = 0;
  const client = new Proxy({}, { get() { accesses += 1; } });

  const result = await resumeGrowthStudioJob(client, jobDir, { expectedWorkflow: "pdp" });

  assert.equal(accesses, 0);
  assert.deepEqual(result, {
    provider: "growth-studio",
    workflow: "pdp",
    ledger_source_id: "627410861853514293",
    trace_id: "pdp-reconcile",
    job_dir: jobDir,
    status: "reconciliation_required",
    retryable: false,
  });
});

test("PDP resume still requires reconciliation when a terminal final lacks a saved ID", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-terminal-no-id-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "unknown-terminal-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({
    workflow: "pdp",
    trace_id: "pdp-terminal-no-id",
  }));
  await fs.writeFile(path.join(jobDir, "final.json"), JSON.stringify({ status: "succeeded" }));
  let accesses = 0;
  const client = new Proxy({}, { get() { accesses += 1; } });

  const result = await resumeGrowthStudioJob(client, jobDir, { expectedWorkflow: "pdp" });

  assert.equal(accesses, 0);
  assert.equal(result.status, "reconciliation_required");
  assert.equal(result.retryable, false);
  assert.equal(result.workflow, "pdp");
  assert.equal(result.video_id, undefined);
});

test("PDP resume rejects a non-PDP job before any client access", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-mismatch-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const jobDir = path.join(root, "video-job");
  await fs.mkdir(jobDir);
  await fs.writeFile(path.join(jobDir, "request.json"), JSON.stringify({ trace_id: "legacy-video" }));
  await fs.writeFile(path.join(jobDir, "video-id.json"), JSON.stringify({
    video_id: "627410861853514292",
  }));
  let accesses = 0;
  const client = new Proxy({}, { get() { accesses += 1; } });

  await assert.rejects(
    resumeGrowthStudioJob(client, jobDir, { expectedWorkflow: "pdp" }),
    /Growth Studio job is not a pdp workflow\./,
  );
  assert.equal(accesses, 0);
});

test("PDP create failures preserve a durable request and safe recovery error", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-error-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let submissions = 0;

  await assert.rejects(
    runPdpJob({
      async createPdpVideo() {
        submissions += 1;
        throw new TypeError("transport failed with api_key=pdp-secret");
      },
    }, validPdpPayload(), { jobsDir: root, traceId: "pdp-error" }),
    /pdp-secret/,
  );

  const [entry] = await fs.readdir(root);
  const jobDir = path.join(root, entry);
  const request = JSON.parse(await fs.readFile(path.join(jobDir, "request.json"), "utf8"));
  const failure = JSON.parse(await fs.readFile(path.join(jobDir, "error.json"), "utf8"));
  assert.equal(submissions, 1);
  assert.equal(request.workflow, "pdp");
  assert.equal(failure.category, "transport");
  assert.doesNotMatch(JSON.stringify(failure), /pdp-secret/);
  await assert.rejects(fs.access(path.join(jobDir, "video-id.json")), { code: "ENOENT" });
  await assert.rejects(fs.access(path.join(jobDir, "folder.json")), { code: "ENOENT" });
});

test("PDP validates before creating a job directory", async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-invalid-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const jobsDir = path.join(parent, "jobs-that-must-not-exist");
  let accesses = 0;
  const client = new Proxy({}, { get() { accesses += 1; } });

  await assert.rejects(
    runPdpJob(client, {
      product: { title: "Invalid", images: [] },
      video: { mode: "pro" },
    }, { jobsDir }),
    /1 to 8/,
  );

  assert.equal(accesses, 0);
  await assert.rejects(fs.access(jobsDir), { code: "ENOENT" });
});

test("PDP rejects unsafe numeric response identifiers", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-ids-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cases = [
    [{ video_id: 627410861853514292, status: "processing" }, /string video_id/],
    [{
      video_id: "627410861853514292",
      ledger_source_id: 627410861853514292,
      status: "processing",
    }, /string ledger_source_id/],
  ];

  for (const [body, message] of cases) {
    let submissions = 0;
    await assert.rejects(
      runPdpJob({
        async createPdpVideo() {
          submissions += 1;
          return { body };
        },
      }, validPdpPayload(), { jobsDir: root, poll: false }),
      message,
    );
    assert.equal(submissions, 1);
  }
});

test("PDP tolerates an absent ledger source ID without synthesizing one", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-pdp-no-ledger-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await runPdpJob({
    async createPdpVideo() {
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
  }, validPdpPayload(), { jobsDir: root, poll: false });

  assert.equal(result.workflow, "pdp");
  assert.equal(Object.hasOwn(result, "ledger_source_id"), false);
  await assert.rejects(fs.access(path.join(result.job_dir, "ledger-source-id.json")), { code: "ENOENT" });
});
