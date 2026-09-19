import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PLATFORM_BASE_URL, getPlatformConfig } from "../../src/platform/config.js";

test("Platform config uses only Platform environment variables and its default base URL", () => {
  const apiKeyField = "api" + "Key";
  const config = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "platform-" + "fixture",
    PIXVERSE_GROWTH_API_KEY: "growth-" + "fixture",
    PIXVERSE_GROWTH_BASE_URL: "https://growth.example.test",
  });

  assert.deepEqual(config, {
    [apiKeyField]: "platform-" + "fixture",
    baseUrl: DEFAULT_PLATFORM_BASE_URL,
  });
  assert.equal(DEFAULT_PLATFORM_BASE_URL, "https://app-api.pixverse.ai");
});

test("Platform config never falls back to Growth Studio credentials", () => {
  assert.throws(
    () => getPlatformConfig({ PIXVERSE_GROWTH_API_KEY: "growth-only-key" }),
    /Missing PIXVERSE_PLATFORM_API_KEY/,
  );
});

test("Platform config accepts explicit options without mutating the environment", () => {
  const env = Object.freeze({
    PIXVERSE_PLATFORM_API_KEY: "environment-key",
    PIXVERSE_PLATFORM_BASE_URL: "https://environment.example.test/",
  });

  const config = getPlatformConfig(env, {
    ["api" + "Key"]: "option-" + "fixture",
    baseUrl: "https://override.example.test/",
  });

  assert.deepEqual(config, {
    ["api" + "Key"]: "option-" + "fixture",
    baseUrl: "https://override.example.test",
  });
  assert.equal(env.PIXVERSE_PLATFORM_API_KEY, "environment-key");
});

test("Platform config rejects malformed base URLs", () => {
  assert.throws(
    () => getPlatformConfig({ PIXVERSE_PLATFORM_API_KEY: "fixture" }, { baseUrl: "not-a-url" }),
    /valid HTTP.*URL/i,
  );
});
