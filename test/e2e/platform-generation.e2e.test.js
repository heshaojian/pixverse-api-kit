import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PlatformClient } from "../../src/platform/client.js";
import { submitPlatformJob } from "../../src/platform/jobs.js";
import { createMockApiServer, sendJson } from "../helpers/mock-api-server.js";
import { createTempJobRoot, readJobArtifacts } from "../helpers/temp-job-dir.js";

test("offline upload feeds image generation and reaches success", async (t) => {
  const root = await createTempJobRoot(t);
  const image = fileURLToPath(new URL("../fixtures/media/tiny.png", import.meta.url));
  let statusReads = 0;
  const server = await createMockApiServer((request, response) => {
    if (request.url === "/openapi/v2/image/upload") return sendJson(response, { ErrCode: 0, Resp: { img_id: "17" } });
    if (request.url === "/openapi/v2/video/img/generate") return sendJson(response, { ErrCode: 0, Resp: { video_id: "99" } });
    if (request.url === "/openapi/v2/video/result/99") {
      statusReads += 1;
      return sendJson(response, { ErrCode: 0, Resp: { id: "99", status: statusReads === 1 ? 5 : 1, url: "https://example.com/final.mp4" } });
    }
    throw new Error(`Unexpected request ${request.url}`);
  });
  t.after(() => server.close());
  const client = new PlatformClient({ apiKey: "test-key", baseUrl: server.baseUrl, fetchImpl: globalThis.fetch, inspectLocalMedia: async () => ({ size_bytes: 90, width: 1, height: 1, streams: [{ codec_type: "video" }] }) });
  const upload = await client.execute("upload.image", { image });
  const result = await submitPlatformJob(client, "video.image", {
    img_id: upload.data.img_id, prompt: "subtle motion", model: "v6", duration: 5, quality: "720p",
  }, { jobRoot: root, poll: true, sleep: async () => {}, now: (() => { let n = 0; return () => n++; })() });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(server.requests.map(({ method, url }) => [method, url]), [
    ["POST", "/openapi/v2/image/upload"], ["POST", "/openapi/v2/video/img/generate"],
    ["GET", "/openapi/v2/video/result/99"], ["GET", "/openapi/v2/video/result/99"],
  ]);
  assert.equal((await readJobArtifacts(result.job_dir))["final.json"].data.url, "https://example.com/final.mp4");
  assert.equal((await fs.stat(path.join(result.job_dir, "request.json"))).isFile(), true);
});

test("offline audio upload, verification, and Music MV generation reach success", async (t) => {
  const root = await createTempJobRoot(t);
  const audio = fileURLToPath(new URL("../fixtures/media/tiny.wav", import.meta.url));
  let statusReads = 0;
  const server = await createMockApiServer((request, response) => {
    if (request.url === "/openapi/v2/media/upload") {
      return sendJson(response, { ErrCode: 0, Resp: { media_id: "405833376854443" } });
    }
    if (request.url === "/openapi/v2/audio/verification") {
      return sendJson(response, { ErrCode: 0, Resp: {} });
    }
    if (request.url === "/openapi/v2/video/music_mv_agent/generate") {
      return sendJson(response, { ErrCode: 0, Resp: { video_id: "629000000000000023" } });
    }
    if (request.url === "/openapi/v2/video/result/629000000000000023") {
      statusReads += 1;
      return sendJson(response, {
        ErrCode: 0,
        Resp: {
          id: "629000000000000023",
          status: statusReads === 1 ? 5 : 1,
          url: "https://example.test/music-mv.mp4",
        },
      });
    }
    throw new Error(`Unexpected request ${request.url}`);
  });
  t.after(() => server.close());
  const client = new PlatformClient({
    apiKey: "test-key",
    baseUrl: server.baseUrl,
    fetchImpl: globalThis.fetch,
    inspectLocalMedia: async () => ({ size_bytes: 256, duration_seconds: 12, streams: [{ codec_type: "audio" }] }),
  });

  const upload = await client.execute("upload.media", { file: audio });
  await client.execute("audio.verify", { audio_media_id: upload.data.media_id });
  const result = await submitPlatformJob(client, "agent.music-mv", {
    mv_agent_type: "vibe_mv_v3_custom",
    audio_media_id: upload.data.media_id,
    aspect_ratio: "16:9",
    quality: "720p",
  }, { jobRoot: root, poll: true, sleep: async () => {} });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(server.requests.map(({ method, url }) => [method, url]), [
    ["POST", "/openapi/v2/media/upload"],
    ["POST", "/openapi/v2/audio/verification"],
    ["POST", "/openapi/v2/video/music_mv_agent/generate"],
    ["GET", "/openapi/v2/video/result/629000000000000023"],
    ["GET", "/openapi/v2/video/result/629000000000000023"],
  ]);
  assert.equal((await readJobArtifacts(result.job_dir))["final.json"].data.url, "https://example.test/music-mv.mp4");
});

for (const [rawStatus, expected] of [[6, "deleted"], [7, "moderation_failed"], [8, "failed"]]) {
  test(`terminal ${expected} writes final and safe error artifacts`, async (t) => {
    const root = await createTempJobRoot(t);
    const client = { execute: async (id) => id === "video.text"
      ? { operation: id, traceId: "11111111-1111-4111-8111-111111111111", envelope: { ErrCode: 0, Resp: { video_id: "9" } }, data: { video_id: "9" } }
      : { operation: id, traceId: "status", envelope: { ErrCode: 0, Resp: { id: "9", status: rawStatus } }, data: { id: "9", status: rawStatus } } };
    await assert.rejects(submitPlatformJob(client, "video.text", { prompt: "x", model: "v6", duration: 5, quality: "720p", aspect_ratio: "16:9" }, {
      jobRoot: root, poll: true, sleep: async () => {}, now: () => 0,
    }), (error) => error.category === expected);
    const [jobName] = await fs.readdir(root);
    const artifacts = await readJobArtifacts(path.join(root, jobName));
    assert.equal(artifacts["final.json"].status, expected);
    assert.equal(artifacts["error.json"].category, expected);
  });
}
