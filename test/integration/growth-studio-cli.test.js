import assert from "node:assert/strict";
import test from "node:test";

import { main } from "../../src/cli.js";

test("canonical Growth Studio namespace is independent from Platform configuration", async () => {
  const output = captureOutput();
  const exitCode = await main(["growth-studio", "avatars", "list"], {
    env: { PIXVERSE_PLATFORM_API_KEY: "platform-fixture-key" },
    ...output.context,
    runGrowthStudioCommand: async (args) => {
      assert.deepEqual(args, ["avatars", "list"]);
      return { avatars: [{ id: "avatar-1" }] };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output.stdout()), { avatars: [{ id: "avatar-1" }] });
  assert.equal(output.stderr(), "");
});

test("legacy aliases delegate to Growth Studio namespace with one warning", async () => {
  const output = captureOutput();
  const exitCode = await main(["poll", "627410861853514292"], {
    env: {},
    ...output.context,
    runGrowthStudioCommand: async (args) => {
      assert.deepEqual(args, ["video", "poll", "627410861853514292"]);
      return { video_id: "627410861853514292", status: "succeeded" };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(JSON.parse(output.stdout()).status, "succeeded");
  assert.match(output.stderr(), /legacy command syntax is deprecated/);
});

function captureOutput() {
  let stdout = "";
  let stderr = "";
  return {
    context: {
      stdout: { write: (chunk) => { stdout += chunk; } },
      stderr: { write: (chunk) => { stderr += chunk; } },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}
