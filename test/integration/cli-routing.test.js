import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { main } from "../../src/cli.js";
import { formatError, formatSuccess } from "../../src/cli/output.js";
import { routeCommand } from "../../src/cli/router.js";
import { importCli, runCli } from "../helpers/cli-process.js";

test("routeCommand separates provider commands from legacy Growth Studio aliases", () => {
  assert.deepEqual(routeCommand(["growth-studio", "folders", "list"]), {
    provider: "growth-studio",
    providerArgs: ["folders", "list"],
    legacy: false,
  });
  assert.deepEqual(routeCommand(["platform", "account", "balance"]), {
    provider: "platform",
    providerArgs: ["account", "balance"],
    legacy: false,
  });
  assert.deepEqual(routeCommand(["get", "627410861853514292"]), {
    provider: "growth-studio",
    providerArgs: ["video", "get", "627410861853514292"],
    legacy: true,
    legacyCommand: "get",
  });
  assert.equal(routeCommand(["not-a-provider"]).provider, "unknown");
});

test("formatters preserve JSON output and redact structured errors", () => {
  assert.equal(formatSuccess({ video_id: "627410861853514292" }), '{\n  "video_id": "627410861853514292"\n}\n');
  const keyField = "api" + "_key";
  const formatted = formatError(Object.assign(new Error("request failed"), {
    details: { [keyField]: "do-not-print" },
  }));
  assert.match(formatted, /"message": "request failed"/);
  assert.doesNotMatch(formatted, /do-not-print/);
});

test("main prints top-level help without loading either provider configuration", async () => {
  const output = captureOutput();
  let providerCalls = 0;
  const exitCode = await main(["--help"], {
    env: {},
    ...output.context,
    runGrowthStudioCommand: async () => { providerCalls += 1; },
    runPlatformCommand: async () => { providerCalls += 1; },
  });

  assert.equal(exitCode, 0);
  assert.equal(providerCalls, 0);
  assert.match(output.stdout(), /pixverse-api growth-studio/);
  assert.match(output.stdout(), /pixverse-api platform/);
  assert.equal(output.stderr(), "");
});

test("main injects the full context into canonical Growth Studio commands", async () => {
  const output = captureOutput();
  const env = Object.freeze({ TEST_ENVIRONMENT: "fixture" });
  const fetchImpl = async () => new Response();
  const sleep = async () => {};
  const now = () => 42;
  let received;

  const exitCode = await main(["growth-studio", "folders", "list"], {
    env,
    fetchImpl,
    sleep,
    now,
    cwd: "/tmp/pixverse-cli-fixture",
    ...output.context,
    runGrowthStudioCommand: async (args, context) => {
      received = { args, context };
      return { folders: [] };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(received.args, ["folders", "list"]);
  assert.equal(received.context.env, env);
  assert.equal(received.context.fetchImpl, fetchImpl);
  assert.equal(received.context.sleep, sleep);
  assert.equal(received.context.now, now);
  assert.equal(received.context.cwd, "/tmp/pixverse-cli-fixture");
  assert.equal(JSON.parse(output.stdout()).folders.length, 0);
});

test("legacy commands write one deprecation line and unchanged JSON stdout", async () => {
  const output = captureOutput();
  const exitCode = await main(["get", "627410861853514292"], {
    env: {},
    ...output.context,
    runGrowthStudioCommand: async (args) => {
      assert.deepEqual(args, ["video", "get", "627410861853514292"]);
      return { video_id: "627410861853514292" };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(JSON.parse(output.stdout()).video_id, "627410861853514292");
  assert.equal(output.stderr().trim().split("\n").length, 1);
  assert.match(output.stderr(), /deprecated.*growth-studio/i);
});

test("unknown providers fail cleanly and imported functions never exit the process", async () => {
  const output = captureOutput();
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    const exitCode = await main(["unknown", "command"], { env: {}, ...output.context });
    assert.equal(exitCode, 1);
    assert.equal(process.exitCode, undefined);
  } finally {
    process.exitCode = originalExitCode;
  }
  assert.match(output.stderr(), /Unknown provider or command/);
});

test("platform placeholder does not load Growth Studio configuration", async () => {
  const output = captureOutput();
  let growthStudioCalls = 0;
  const exitCode = await main(["platform", "account", "balance"], {
    env: {},
    ...output.context,
    runGrowthStudioCommand: async () => { growthStudioCalls += 1; },
  });

  assert.equal(exitCode, 1);
  assert.equal(growthStudioCalls, 0);
  assert.match(output.stderr(), /Platform commands are not available yet/);
});

test("CLI module import is process-isolated and has no output", async () => {
  const result = await importCli({ env: { PIXVERSE_GROWTH_API_KEY: "" } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("executable CLI help and unknown commands return stable exit codes", async () => {
  const help = await runCli(["--help"], { env: { PIXVERSE_GROWTH_API_KEY: "" } });
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /pixverse-api growth-studio/);
  assert.equal(help.stderr, "");

  const unknown = await runCli(["unknown"], { env: { PIXVERSE_GROWTH_API_KEY: "" } });
  assert.equal(unknown.exitCode, 1);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /Unknown provider or command/);
});

test("legacy executable preserves JSON stdout and emits one deprecation line", async () => {
  const server = http.createServer((request, response) => {
    assert.equal(request.url, "/marketing_hub/folder/list");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ folders: [{ folder_id: "630251570268735431" }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const result = await runCli(["folders"], {
      env: {
        PIXVERSE_GROWTH_API_KEY: "mh_" + "live_fixture",
        PIXVERSE_GROWTH_BASE_URL: `http://127.0.0.1:${port}`,
      },
    });

    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      folders: [{ folder_id: "630251570268735431" }],
    });
    assert.equal(result.stderr.trim().split("\n").length, 1);
    assert.match(result.stderr, /deprecated.*growth-studio/i);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function captureOutput() {
  const stdoutChunks = [];
  const stderrChunks = [];
  return {
    context: {
      stdout: { write: (value) => { stdoutChunks.push(String(value)); } },
      stderr: { write: (value) => { stderrChunks.push(String(value)); } },
    },
    stdout: () => stdoutChunks.join(""),
    stderr: () => stderrChunks.join(""),
  };
}
