import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCli } from "./helpers/cli-process.js";
import { createMockApiServer, sendJson } from "./helpers/mock-api-server.js";

test("child CLI processes strip ambient PixVerse API keys unless explicitly supplied", async (t) => {
  const previous = process.env.PIXVERSE_PLATFORM_API_KEY;
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-no-paid-network-"));
  process.env.PIXVERSE_PLATFORM_API_KEY = "platform-fixture-key";
  const server = await createMockApiServer((_request, response) => sendJson(response, {
    ErrCode: 0,
    ErrMsg: "success",
    Resp: { credit_monthly: 10 },
  }));
  t.after(async () => {
    await server.close();
    if (previous === undefined) delete process.env.PIXVERSE_PLATFORM_API_KEY;
    else process.env.PIXVERSE_PLATFORM_API_KEY = previous;
  });

  const inherited = await runCli(["platform", "account", "balance"], {
    env: { PIXVERSE_PLATFORM_BASE_URL: server.baseUrl },
    cwd,
  });
  assert.equal(inherited.exitCode, 1);
  assert.match(inherited.stderr, /PIXVERSE_PLATFORM_API_KEY/);
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

test("default help paths do not require credentials or contact PixVerse hosts", async () => {
  const result = await runCli(["--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /pixverse-api platform/);
  assert.doesNotMatch(result.stderr, /PIXVERSE_.*API_KEY/);
});
