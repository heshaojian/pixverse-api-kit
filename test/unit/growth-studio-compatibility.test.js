import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as flatClient from "../../src/client.js";
import * as flatConfig from "../../src/config.js";
import * as flatFolders from "../../src/folders.js";
import * as flatHttp from "../../src/http.js";
import * as flatJobs from "../../src/jobs.js";
import {
  GROWTH_STUDIO_LEGACY_COMMAND_MAPPINGS,
  getGrowthStudioHelp,
  mapLegacyGrowthStudioCommand,
  runGrowthStudioCommand,
} from "../../src/growth-studio/cli.js";
import * as growthClient from "../../src/growth-studio/client.js";
import * as growthConfig from "../../src/growth-studio/config.js";
import * as growthFolders from "../../src/growth-studio/folders.js";
import * as growthJobs from "../../src/growth-studio/jobs.js";
import * as growthValidation from "../../src/growth-studio/validation.js";

test("flat modules preserve Growth Studio named exports", () => {
  assert.equal(flatClient.GrowthStudioClient, growthClient.GrowthStudioClient);
  assert.equal(flatClient.createProductUrlPayload, growthClient.createProductUrlPayload);
  assert.equal(flatClient.validateCreatePayload, growthValidation.validateCreatePayload);
  assert.equal(flatClient.validateEditPayload, growthValidation.validateEditPayload);
  assert.equal(flatClient.validateFolderPayload, growthValidation.validateFolderPayload);
  assert.equal(flatConfig.getConfig, growthConfig.getConfig);
  assert.equal(flatFolders.resolveFolderForPayload, growthFolders.resolveFolderForPayload);
  assert.equal(flatJobs.runVideoJob, growthJobs.runVideoJob);
  assert.equal(flatHttp.parseResponse, growthClient.parseResponse);
});

test("Growth Studio config has a provider-specific name and preserves folder key override", () => {
  const apiKeyField = "api" + "Key";
  const folderApiKeyField = "folderApi" + "Key";
  const config = growthConfig.getGrowthStudioConfig({
    PIXVERSE_GROWTH_API_KEY: "mh_" + "live_fixture_video",
    PIXVERSE_GROWTH_FOLDER_API_KEY: "mh_" + "live_fixture_folder",
    PIXVERSE_GROWTH_FOLDER_API_PREFIX: "/openapi/v1/growth-studio",
    PIXVERSE_GROWTH_BASE_URL: "https://growth.example.test",
  });

  assert.deepEqual(config, {
    [apiKeyField]: "mh_" + "live_fixture_video",
    [folderApiKeyField]: "mh_" + "live_fixture_folder",
    folderApiPrefix: "/openapi/v1/growth-studio",
    baseUrl: "https://growth.example.test",
  });
  assert.equal(growthConfig.getConfig, growthConfig.getGrowthStudioConfig);
});

test("Growth Studio config rejects missing or non-production API keys", () => {
  assert.throws(
    () => growthConfig.getGrowthStudioConfig({}),
    /Missing PIXVERSE_GROWTH_API_KEY/,
  );
  assert.throws(
    () => growthConfig.getGrowthStudioConfig({ PIXVERSE_GROWTH_API_KEY: "mh_test_fixture" }),
    /must be a production key/,
  );
});

test("Growth Studio dotenv loader preserves existing environment values", async () => {
  const envPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-env-")), ".env");
  const existing = process.env.PIXVERSE_COMPAT_EXISTING;
  const loaded = process.env.PIXVERSE_COMPAT_LOADED;
  process.env.PIXVERSE_COMPAT_EXISTING = "original";
  delete process.env.PIXVERSE_COMPAT_LOADED;
  await fs.writeFile(envPath, [
    "# comment",
    "PIXVERSE_COMPAT_EXISTING=from_file",
    "PIXVERSE_COMPAT_LOADED='from_file'",
    "MALFORMED_LINE",
    "",
  ].join("\n"));

  try {
    growthConfig.loadDotEnv(envPath);

    assert.equal(process.env.PIXVERSE_COMPAT_EXISTING, "original");
    assert.equal(process.env.PIXVERSE_COMPAT_LOADED, "from_file");
  } finally {
    if (existing === undefined) delete process.env.PIXVERSE_COMPAT_EXISTING;
    else process.env.PIXVERSE_COMPAT_EXISTING = existing;
    if (loaded === undefined) delete process.env.PIXVERSE_COMPAT_LOADED;
    else process.env.PIXVERSE_COMPAT_LOADED = loaded;
  }
});

test("namespaced client preserves bearer auth and numeric-string IDs", async () => {
  const calls = [];
  const client = new growthClient.GrowthStudioClient({
    ["api" + "Key"]: "fixture-credential",
    baseUrl: "https://growth.example.test",
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(JSON.stringify({
        video_id: "627410861853514292",
        status: "succeeded",
      }));
    },
  });

  const result = await client.getVideo("627410861853514292");

  assert.equal(result.body.video_id, "627410861853514292");
  assert.equal(calls[0].init.headers.get("Authorization"), "Bearer fixture-credential");
});

test("namespaced jobs preserve artifacts and do not mutate payloads during folder injection", async () => {
  const jobsDir = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-compat-"));
  const payload = Object.freeze({
    product: Object.freeze({ source_url: "https://shop.example.test/item" }),
    video: Object.freeze({ aspect_ratio: "9:16" }),
  });
  const client = {
    async createVideo(received) {
      assert.notEqual(received, payload);
      assert.equal(received.folder_id, "630251570268735431");
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
  };

  const result = await growthJobs.runGrowthStudioJob(client, payload, {
    jobsDir,
    folderId: "630251570268735431",
    poll: false,
  });

  assert.equal(payload.folder_id, undefined);
  assert.equal(result.video_id, "627410861853514292");
  assert.equal(result.folder_id, "630251570268735431");
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(result.job_dir, "video-id.json"), "utf8")),
    { video_id: "627410861853514292" },
  );
});

test("legacy commands map to canonical Growth Studio command paths", () => {
  assert.deepEqual(GROWTH_STUDIO_LEGACY_COMMAND_MAPPINGS, {
    avatars: ["avatars", "list"],
    folders: ["folders", "list"],
    "ensure-folder": ["folders", "ensure"],
    "upload-image": ["upload", "image"],
    "create-from-url": ["video", "create-from-url"],
    "create-from-json": ["video", "create-from-json"],
    get: ["video", "get"],
    poll: ["video", "poll"],
    list: ["video", "list"],
    edit: ["video", "edit"],
    "run-job": ["run-job"],
  });
});

test("video status performs one read while video poll retains polling", async () => {
  const calls = [];
  const client = {
    async getVideo(videoId) {
      calls.push(["get", videoId]);
      return { body: { video_id: videoId, status: "processing" } };
    },
    async pollVideo(videoId) {
      calls.push(["poll", videoId]);
      return { video_id: videoId, status: "succeeded" };
    },
  };

  const status = await runGrowthStudioCommand(["video", "status", "627410861853514292"], { client });
  const final = await runGrowthStudioCommand(["video", "poll", "627410861853514292"], { client });

  assert.equal(status.status, "processing");
  assert.equal(final.status, "succeeded");
  assert.deepEqual(calls, [
    ["get", "627410861853514292"],
    ["poll", "627410861853514292"],
  ]);
});

test("Growth Studio command adapter preserves read-only result shapes", async () => {
  const calls = [];
  const client = {
    async listAvatars(options) {
      calls.push(["avatars", options.traceId]);
      return { body: { avatars: [{ id: "avatar-1" }] } };
    },
    async listFolders(options) {
      calls.push(["folders", options.traceId]);
      return { body: { folders: [{ folder_id: "630251570268735431" }] } };
    },
    async listVideos(options) {
      calls.push(["videos", options]);
      return { body: { videos: [{ video_id: "627410861853514292" }] } };
    },
  };

  assert.deepEqual(await runGrowthStudioCommand(["avatars", "list"], { client }), {
    avatars: [{ id: "avatar-1" }],
  });
  assert.deepEqual(await runGrowthStudioCommand(["folders", "list"], { client }), {
    folders: [{ folder_id: "630251570268735431" }],
  });
  assert.deepEqual(
    await runGrowthStudioCommand(["video", "list", "--limit", "20", "--status", "succeeded", "--cursor", "next"], {
      client,
    }),
    { videos: [{ video_id: "627410861853514292" }] },
  );

  assert.equal(calls[0][0], "avatars");
  assert.equal(calls[1][0], "folders");
  assert.deepEqual(calls[2][1], {
    limit: "20",
    status: "succeeded",
    cursor: "next",
    traceId: calls[2][1].traceId,
  });
  assert.match(calls[2][1].traceId, /^list-videos-/);
});

test("Growth Studio command adapter can create its client from provider context", async () => {
  const calls = [];

  const result = await runGrowthStudioCommand(["avatars", "list"], {
    env: {
      PIXVERSE_GROWTH_API_KEY: "mh_" + "live_context_fixture",
      PIXVERSE_GROWTH_BASE_URL: "https://growth.example.test",
    },
    fetchImpl: async (url, init) => {
      calls.push({ url: url.toString(), init });
      return new Response(JSON.stringify({ avatars: [{ id: "avatar-1" }] }));
    },
    sleep: async () => {
      throw new Error("read-only commands should not sleep");
    },
  });

  assert.deepEqual(result, { avatars: [{ id: "avatar-1" }] });
  assert.equal(calls[0].url, "https://growth.example.test/openapi/v1/avatars");
  assert.match(calls[0].init.headers.get("Authorization"), /^Bearer mh_live_context_fixture$/);
});

test("Growth Studio command adapter preserves create, edit, upload, and job behavior", async () => {
  const calls = [];
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-growth-cli-"));
  const payloadPath = path.join(tempRoot, "payload.json");
  const jobsDir = path.join(tempRoot, "jobs");
  await fs.writeFile(payloadPath, JSON.stringify({
    product: { source_url: "https://shop.example.test/item" },
    video: { aspect_ratio: "9:16" },
  }));
  const client = {
    async uploadImage(filePath, options) {
      calls.push(["upload", filePath, options.traceId]);
      return { body: { url: "https://media.pixverse.ai/uploaded.webp" } };
    },
    async createVideo(payload, options) {
      calls.push(["create", payload, options.traceId]);
      return { body: { video_id: "627410861853514292", status: "processing" } };
    },
    async editVideo(videoId, payload, options) {
      calls.push(["edit", videoId, payload, options.traceId]);
      return { body: { video_id: videoId, status: "processing", edit: payload } };
    },
  };

  const upload = await runGrowthStudioCommand(["upload", "image", "/tmp/product.webp"], { client });
  const createdFromUrl = await runGrowthStudioCommand([
    "video",
    "create-from-url",
    "https://shop.example.test/item",
    "--folder-id",
    "630251570268735431",
  ], { client });
  const createdFromJson = await runGrowthStudioCommand([
    "video",
    "create-from-json",
    payloadPath,
  ], { client });
  const edited = await runGrowthStudioCommand([
    "video",
    "edit",
    "627410861853514292",
    "2",
    "make",
    "the",
    "opening",
    "brighter",
  ], { client });
  const job = await runGrowthStudioCommand([
    "run-job",
    "--payload",
    payloadPath,
    "--jobs-dir",
    jobsDir,
    "--job-name",
    "Fixture Job",
    "--timeout-minutes",
    "1",
    "--initial-delay-seconds",
    "0",
    "--fallback-delay-seconds",
    "2",
    "--no-poll",
  ], { client });

  assert.deepEqual(upload, { url: "https://media.pixverse.ai/uploaded.webp" });
  assert.equal(createdFromUrl.folder_id, "630251570268735431");
  assert.equal(createdFromJson.video_id, "627410861853514292");
  assert.deepEqual(edited.edit, {
    clip_index: 2,
    instruction: "make the opening brighter",
  });
  assert.equal(job.video_id, "627410861853514292");
  assert.ok(job.job_dir.startsWith(jobsDir));
  assert.deepEqual(calls.map(([name]) => name), ["upload", "create", "create", "edit", "create"]);
  assert.equal(calls[1][1].folder_id, "630251570268735431");
  assert.equal(calls[2][1].folder_id, undefined);
  assert.equal(calls[4][1].folder_id, undefined);
});

test("Growth Studio folder ensure accepts explicit option form", async () => {
  const client = {
    async listFolders() {
      return { body: { folders: [{ folder_id: "630251570268735431", name: "Fixture Folder" }] } };
    },
    async createFolder() {
      throw new Error("createFolder should not be called");
    },
  };

  const result = await runGrowthStudioCommand([
    "folders",
    "ensure",
    "--folder-name",
    "fixture-folder",
  ], { client });

  assert.equal(result.folderId, "630251570268735431");
  assert.equal(result.source, "existing-folder");
});

test("Growth Studio command adapter rejects incomplete commands without configuration", async () => {
  await assert.rejects(
    runGrowthStudioCommand(["folders", "ensure"], { client: {} }),
    /folders ensure requires a folder name/,
  );
  await assert.rejects(
    runGrowthStudioCommand(["upload", "image"], { client: {} }),
    /upload image requires a file path/,
  );
  await assert.rejects(
    runGrowthStudioCommand(["video", "create-from-url"], { client: {} }),
    /video create-from-url requires a product URL/,
  );
  await assert.rejects(
    runGrowthStudioCommand(["video", "list", "--limit"], { client: {} }),
    /--limit requires a value/,
  );
  await assert.rejects(
    runGrowthStudioCommand(["nope"], { client: {} }),
    /Unknown Growth Studio command/,
  );
});

test("Growth Studio help documents the canonical command tree", () => {
  const help = getGrowthStudioHelp();
  assert.match(help, /pixverse-api growth-studio avatars list/);
  assert.match(help, /pixverse-api growth-studio folders ensure/);
  assert.match(help, /pixverse-api growth-studio video status/);
  assert.match(help, /pixverse-api growth-studio run-job/);
});

test("legacy command mapper returns canonical paths without mutating mappings", () => {
  const args = ["--limit", "20"];

  assert.deepEqual(mapLegacyGrowthStudioCommand("list", args), ["video", "list", "--limit", "20"]);
  assert.equal(mapLegacyGrowthStudioCommand("unknown", args), null);
  assert.deepEqual(args, ["--limit", "20"]);
});
