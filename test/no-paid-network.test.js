import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "./helpers/cli-process.js";
import { createMockApiServer, sendJson } from "./helpers/mock-api-server.js";

test("child CLI processes strip ambient PixVerse API keys unless explicitly supplied", async (t) => {
  const secretNames = [
    "PIXVERSE_PLATFORM_API_KEY",
    "PIXVERSE_GROWTH_API_KEY",
    "PIXVERSE_GROWTH_FOLDER_API_KEY",
    "PIXVERSE_TEST_TOKEN",
    "PIXVERSE_TEST_SECRET",
  ];
  const previous = Object.fromEntries(secretNames.map((name) => [name, process.env[name]]));
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-no-paid-network-"));
  for (const name of secretNames) process.env[name] = `${name.toLowerCase()}-fixture`;
  const server = await createMockApiServer((_request, response) => sendJson(response, {
    ErrCode: 0,
    ErrMsg: "success",
    Resp: { credit_monthly: 10 },
  }));
  t.after(async () => {
    await server.close();
    await fs.rm(cwd, { recursive: true, force: true });
    for (const name of secretNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  assert.equal(new URL(server.baseUrl).hostname, "127.0.0.1");

  const inherited = await runCli(["platform", "account", "balance"], {
    env: { PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
    cwd,
  });
  assert.equal(inherited.exitCode, 1);
  assert.match(inherited.stderr, /PIXVERSE_PLATFORM_API_KEY/);
  assert.equal(server.requests.length, 0);

  const inheritedGrowth = await runCli(["growth-studio", "folders", "list"], {
    env: { PIXVERSE_GROWTH_BASE_URL: server.baseUrl },
    cwd,
  });
  assert.equal(inheritedGrowth.exitCode, 1);
  assert.match(inheritedGrowth.stderr, /PIXVERSE_GROWTH_API_KEY/);
  assert.equal(server.requests.length, 0);

  const explicit = await runCli(["platform", "account", "balance"], {
    env: {
      PIXVERSE_PLATFORM_API_KEY: "platform-fixture-key",
      PIXVERSE_PLATFORM_BASE_URL: server.baseUrl,
    },
    cwd,
  });
  assert.equal(explicit.exitCode, 0);
  assert.equal(server.requests.length, 1);
});

test("child CLI helpers reject credentials without an explicit loopback provider URL", () => {
  assert.throws(
    () => runCli(["platform", "account", "balance"], {
      env: { PIXVERSE_PLATFORM_API_KEY: "platform-fixture-key" },
    }),
    /requires an explicit loopback PIXVERSE_PLATFORM_BASE_URL/,
  );
  assert.throws(
    () => runCli(["growth-studio", "folders", "list"], {
      env: {
        PIXVERSE_GROWTH_API_KEY: "mh_live_fixture",
        PIXVERSE_GROWTH_BASE_URL: "https://growth-api.pixverse.ai",
      },
    }),
    /must use a loopback URL/,
  );
});

test("default help paths do not require credentials or contact PixVerse hosts", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /pixverse-api platform/);
  assert.doesNotMatch(result.stderr, /PIXVERSE_.*API_KEY/);
});
