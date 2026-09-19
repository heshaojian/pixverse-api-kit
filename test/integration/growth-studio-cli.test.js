import assert from "node:assert/strict";
import test from "node:test";

import { main } from "../../src/cli.js";
import { createRecordingFetch, jsonResponse } from "../helpers/recording-fetch.js";

test("canonical Growth Studio namespace is independent from Platform configuration", async () => {
  const output = captureOutput();
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({ ErrCode: 0, Resp: { folders: [{ folder_id: "630251570268735431" }] } }),
  ]);
  const exitCode = await main(["growth-studio", "folders", "list"], {
    env: {
      PIXVERSE_GROWTH_API_KEY: "mh_live_fixture",
      PIXVERSE_GROWTH_BASE_URL: "http://127.0.0.1:1",
    },
    fetchImpl,
    ...output.context,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(JSON.parse(output.stdout()), { folders: [{ folder_id: "630251570268735431" }] });
  assert.equal(output.stderr(), "");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer mh_live_fixture");
  assert.equal(calls[0].headers.has("API-KEY"), false);
});

test("Platform namespace is independent from Growth Studio configuration", async () => {
  const output = captureOutput();
  const { calls, fetchImpl } = createRecordingFetch([
    jsonResponse({ ErrCode: 0, ErrMsg: "success", Resp: { credit_monthly: 10 } }),
  ]);
  const exitCode = await main(["platform", "account", "balance"], {
    env: {
      PIXVERSE_PLATFORM_API_KEY: "platform-fixture-key",
      PIXVERSE_PLATFORM_BASE_URL: "http://127.0.0.1:1",
    },
    fetchImpl,
    ...output.context,
  });

  assert.equal(exitCode, 0, output.stderr());
  assert.equal(JSON.parse(output.stdout()).data.credit_monthly, 10);
  assert.equal(output.stderr(), "");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get("API-KEY"), "platform-fixture-key");
  assert.equal(calls[0].headers.has("Authorization"), false);
});

test("legacy aliases preserve canonical Growth Studio JSON and add one warning", async () => {
  const canonicalOutput = captureOutput();
  const legacyOutput = captureOutput();
  const response = { video_id: "627410861853514292", status: "succeeded" };
  const canonicalFetch = createRecordingFetch([jsonResponse(response)]);
  const legacyFetch = createRecordingFetch([jsonResponse(response)]);
  const env = {
    PIXVERSE_GROWTH_API_KEY: "mh_live_fixture",
    PIXVERSE_GROWTH_BASE_URL: "http://127.0.0.1:1",
  };

  const canonicalExitCode = await main(["growth-studio", "video", "get", "627410861853514292"], {
    env,
    fetchImpl: canonicalFetch.fetchImpl,
    ...canonicalOutput.context,
  });
  const legacyExitCode = await main(["get", "627410861853514292"], {
    env,
    fetchImpl: legacyFetch.fetchImpl,
    ...legacyOutput.context,
  });

  assert.equal(canonicalExitCode, 0);
  assert.equal(legacyExitCode, 0);
  assert.equal(legacyOutput.stdout(), canonicalOutput.stdout());
  assert.deepEqual(JSON.parse(legacyOutput.stdout()), response);
  assert.equal(canonicalOutput.stderr(), "");
  assert.equal(
    legacyOutput.stderr(),
    'Warning: legacy command syntax is deprecated; use the "pixverse-api growth-studio" namespace.\n',
  );
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
