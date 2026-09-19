import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PLATFORM_OPERATIONS } from "../../src/platform/operations.js";
import { getPlatformHelp, runPlatformCommand } from "../../src/platform/cli.js";
import { createMockApiServer, sendJson } from "../helpers/mock-api-server.js";

const TEST_KEY = ["fixture", "platform", "credential"].join("-");

test("Platform help is catalog-driven and exposes every specialized operation", () => {
  const help = getPlatformHelp();
  for (const operation of PLATFORM_OPERATIONS) {
    assert.match(help, new RegExp(`pixverse-api platform ${operation.command.join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(help, /platform raw <method> <\/openapi\/v2\/path>/);
  assert.equal((help.match(/pixverse-api platform /g) ?? []).length, PLATFORM_OPERATIONS.length + 1);
});

test("catalog commands read --payload and produce a stable JSON-safe result over loopback", async (t) => {
  const server = await createMockApiServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/openapi/v2/video/text/generate");
    assert.equal(request.headers["api-key"], TEST_KEY);
    assert.match(request.headers["ai-trace-id"], /^[0-9a-f-]{36}$/i);
    assert.deepEqual(JSON.parse(request.body), {
      prompt: "quiet product shot", model: "v6", duration: 5, quality: "720p", aspect_ratio: "16:9",
    });
    sendJson(response, '{"ErrCode":0,"ErrMsg":"success","Resp":{"video_id":627410861853514292}}');
  });
  t.after(() => server.close());
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "platform-cli-"));
  const payloadPath = path.join(directory, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    prompt: "quiet product shot", model: "v6", duration: 5, quality: "720p", aspect_ratio: "16:9",
  }));

  const result = await runPlatformCommand(["video", "text", "--payload", payloadPath], {
    env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY, PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
    fetchImpl: globalThis.fetch,
    cwd: directory,
  });

  assert.equal(result.operation, "video.text");
  assert.equal(result.data.video_id, "627410861853514292");
  assert.equal(server.requests.length, 1);
});

test("concise positional forms cover uploads, status lookups, and voice deletion", async (t) => {
  const tinyImage = fileURLToPath(new URL("../fixtures/media/tiny.png", import.meta.url));
  const seen = [];
  const server = await createMockApiServer((request, response) => {
    seen.push(request);
    sendJson(response, { ErrCode: 0, ErrMsg: "success", Resp: {} });
  });
  t.after(() => server.close());
  const context = {
    env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY, PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
    fetchImpl: globalThis.fetch,
    inspectLocalMedia: async () => ({ size_bytes: 90, width: 1, height: 1, streams: [{ codec_type: "video" }] }),
  };

  await runPlatformCommand(["upload", "image", tinyImage], context);
  await runPlatformCommand(["video", "status", "627410861853514292"], context);
  await runPlatformCommand(["image", "status", "627410861853514293"], context);
  await runPlatformCommand(["voice", "delete", "speaker/7"], context);

  assert.deepEqual(seen.map(({ method, url }) => [method, url]), [
    ["POST", "/openapi/v2/image/upload"],
    ["GET", "/openapi/v2/video/result/627410861853514292"],
    ["GET", "/openapi/v2/image/result/627410861853514293"],
    ["DELETE", "/openapi/v2/video/tts_speaker/speaker%2F7"],
  ]);
  const multipart = seen[0];
  assert.match(multipart.headers["content-type"], /^multipart\/form-data; boundary=/);
  assert.equal(multipart.body.includes(await fs.readFile(tinyImage)), true);
  assert.match(multipart.body.toString("latin1"), /name="image"; filename="tiny\.png"/);
});

test("--dry-run validates locally without a key, request, artifact, or secret leak", async () => {
  let requests = 0;
  const sensitiveField = ["api", "key"].join("_");
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "platform-dry-run-"));
  const payloadPath = path.join(cwd, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify({
    prompt: "test", model: "v6", duration: 5, quality: "720p", aspect_ratio: "16:9",
    [sensitiveField]: "must-not-appear",
  }));

  const result = await runPlatformCommand([
    "video", "text", "--payload", payloadPath, "--dry-run",
  ], { env: {}, cwd, fetchImpl: async () => { requests += 1; } });

  assert.equal(result.dry_run, true);
  assert.equal(result.operation, "video.text");
  assert.equal(result.request.method, "POST");
  assert.equal(result.request.path, "/openapi/v2/video/text/generate");
  assert.equal(result.request.normalized.payload[sensitiveField], "[REDACTED]");
  assert.equal(requests, 0);
  assert.deepEqual(await fs.readdir(cwd), ["payload.json"]);
  assert.doesNotMatch(JSON.stringify(result), /must-not-appear/);
});

test("upload dry-run inspects the real input but emits only safe file metadata", async () => {
  const privateDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "private-upload-source-"));
  const filePath = path.join(privateDirectory, "reference.png");
  await fs.writeFile(filePath, Buffer.from("fixture"));
  let inspectedPath;

  const result = await runPlatformCommand(["upload", "image", filePath, "--dry-run"], {
    env: {},
    inspectLocalMedia: async (value) => {
      inspectedPath = value;
      return { size_bytes: 7, width: 1, height: 1 };
    },
  });

  assert.equal(inspectedPath, filePath);
  assert.deepEqual(result.request.normalized.files.image, {
    supplied: true,
    basename: "reference.png",
    inspected: true,
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(privateDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Platform validation and API failures remain provider-specific", async () => {
  await assert.rejects(
    runPlatformCommand(["video", "status", ""], {
      env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY },
      fetchImpl: async () => { throw new Error("validation must happen before fetch"); },
    }),
    (error) => error.provider === "platform" && error.category === "validation",
  );
  await assert.rejects(
    runPlatformCommand(["not", "cataloged"], { env: {} }),
    (error) => error.provider === "platform" && error.code === "UNKNOWN_PLATFORM_COMMAND",
  );
  await assert.rejects(
    runPlatformCommand(["video", "text"], { env: {} }),
    (error) => error.provider === "platform" && error.code === "PLATFORM_INPUT_REQUIRED",
  );
});

test("raw access accepts one normalized relative v2 path and never retries", async (t) => {
  const server = await createMockApiServer((request, response, index) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/openapi/v2/future/operation?mode=safe");
    assert.equal(request.headers["api-key"], TEST_KEY);
    assert.match(request.headers["ai-trace-id"], /^[0-9a-f-]{36}$/i);
    assert.deepEqual(JSON.parse(request.body), { value: 1 });
    sendJson(response, { error: { message: "busy" } }, index === 0 ? 503 : 200);
  });
  t.after(() => server.close());
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "platform-raw-"));
  await fs.writeFile(path.join(cwd, "payload.json"), '{"value":1}');

  await assert.rejects(runPlatformCommand([
    "raw", "POST", "/openapi/v2/future/operation?mode=safe", "--payload", "payload.json",
  ], {
    env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY, PIXVERSE_PLATFORM_BASE_URL: server.baseUrl }, cwd, fetchImpl: globalThis.fetch,
  }), (error) => error.status === 503);
  assert.equal(server.requests.length, 1);
});

test("raw access rejects URL escape, injection, auth override, and trace reuse before fetch", async () => {
  let requests = 0;
  const context = {
    env: { PIXVERSE_PLATFORM_API_KEY: TEST_KEY },
    fetchImpl: async () => { requests += 1; },
  };
  const unsafe = [
    ["raw", "GET", "https://evil.example/openapi/v2/account/balance"],
    ["raw", "GET", "/openapi/v2/../admin"],
    ["raw", "GET", "/openapi/v2/%2e%2e/admin"],
    ["raw", "GET", "/openapi/v2/%252e%252e/admin"],
    ["raw", "GET", "/openapi/v2/%2525252e%2525252e/admin"],
    ["raw", "GET", "/openapi/v2//account/balance"],
    ["raw", "GET", "/openapi/v2/account/balance#outside"],
    ["raw", "GET", "/openapi/v2/account/balance\r\nX-Evil: yes"],
    ["raw", "GET", "/openapi/v2/account/balance?value=%0d%0aX-Evil"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Authorization: Bearer nope"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "API-KEY: nope"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "X-API-Key: nope"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Ai-trace-id: reused"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "X-Test: safe\u0000unsafe"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "TE: trailers"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Trailer: x-checksum"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Upgrade: websocket"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Keep-Alive: timeout=5"],
    ["raw", "GET", "/openapi/v2/account/balance", "--header", "Proxy_Connection: keep-alive"],
    ["raw", "GET", "/openapi/v2/account/balance", "--trace-id", "reused"],
    ["raw", "CONNECT", "/openapi/v2/account/balance"],
  ];
  for (const argv of unsafe) {
    await assert.rejects(runPlatformCommand(argv, context), (error) => error.category === "validation");
  }
  assert.equal(requests, 0);
});
