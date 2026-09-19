import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PlatformClient } from "../../src/platform/client.js";
import { resumePlatformJob, submitPlatformJob } from "../../src/platform/jobs.js";
import { createMockApiServer } from "../helpers/mock-api-server.js";
import { createTempJobRoot, readJobArtifacts } from "../helpers/temp-job-dir.js";

test("ambiguous agent acceptance is resumable without a second billable POST", async (t) => {
  const root = await createTempJobRoot(t);
  let accepted = 0;
  const server = await createMockApiServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/openapi/v2/video/agent/generate");
    accepted += 1;
    response.destroy();
  });
  t.after(() => server.close());
  const client = new PlatformClient({ apiKey: "test-key", baseUrl: server.baseUrl, fetchImpl: globalThis.fetch });
  await assert.rejects(submitPlatformJob(client, "agent.viral-recreation", {
    agent_id: "414562414124109",
    prompt: "Recreate pacing.",
    quality: "720p",
    img_references: [{ img_url: "https://cdn.example.test/a.png" }],
    video_references: [{ video_url: "https://cdn.example.test/a.mp4" }],
  }, { jobRoot: root, traceIdFactory: () => "11111111-1111-4111-8111-111111111111" }),
  (error) => error.category === "transport");
  const [jobName] = await fs.readdir(root);
  const result = await resumePlatformJob(client, path.join(root, jobName));
  assert.equal(accepted, 1);
  assert.equal(server.requests.length, 1);
  assert.equal(result.status, "reconciliation_required");
});

test("unknown status is preserved until timeout with final and error artifacts", async (t) => {
  const root = await createTempJobRoot(t);
  let clock = 0;
  const client = { execute: async (id) => id === "video.text"
    ? { operation: id, traceId: "11111111-1111-4111-8111-111111111111", envelope: { ErrCode: 0, Resp: { video_id: "9" } }, data: { video_id: "9" } }
    : { operation: id, traceId: "status", envelope: { ErrCode: 0, Resp: { id: "9", status: 777 } }, data: { id: "9", status: 777 } } };
  await assert.rejects(submitPlatformJob(client, "video.text", { prompt: "x", model: "v6", duration: 5, quality: "720p", aspect_ratio: "16:9" }, {
    jobRoot: root, poll: true, intervalMs: 5, timeoutMs: 5, now: () => clock, sleep: async (ms) => { clock += ms; },
  }), (error) => error.category === "timeout");
  const [jobName] = await fs.readdir(root);
  const artifacts = await readJobArtifacts(path.join(root, jobName));
  assert.equal(artifacts["polling.jsonl"].at(-1).status, "unknown");
  assert.equal(artifacts["polling.jsonl"].at(-1).raw_status, 777);
  assert.equal(artifacts["final.json"].status, "unknown");
  assert.equal(artifacts["final.json"].trace_id, artifacts["request.json"].trace_id);
  assert.equal(artifacts["final.json"].status_trace_id, "status");
  assert.equal(artifacts["error.json"].category, "timeout");

  const calls = [];
  const resumed = await resumePlatformJob({ execute: async (id, input) => {
    calls.push([id, input]);
    return {
      operation: id, traceId: "resume-status",
      envelope: { ErrCode: 0, Resp: { id: "9", status: 1 } },
      data: { id: "9", status: 1 },
    };
  } }, path.join(root, jobName), { sleep: async () => {} });
  assert.deepEqual(calls, [["video.status", { video_id: "9" }]]);
  assert.equal(resumed.status, "succeeded");
  const recoveredArtifacts = await readJobArtifacts(path.join(root, jobName));
  assert.equal(recoveredArtifacts["final-timeout-1.json"].status, "unknown");
  assert.equal(recoveredArtifacts["final.json"].status, "succeeded");
});
