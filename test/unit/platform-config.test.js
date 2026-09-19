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
    PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL: "true",
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

test("Platform config accepts the official HTTPS origin and loopback development origins", () => {
  const official = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "fixture",
    PIXVERSE_PLATFORM_BASE_URL: "https://app-api.pixverse.ai/",
  });
  const ipv4 = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "fixture",
    PIXVERSE_PLATFORM_BASE_URL: "http://127.0.0.1:4312/",
  });
  const localhost = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "fixture",
    PIXVERSE_PLATFORM_BASE_URL: "https://localhost:4312/",
  });
  const ipv6 = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "fixture",
    PIXVERSE_PLATFORM_BASE_URL: "http://[::1]:4312/",
  });

  assert.equal(official.baseUrl, "https://app-api.pixverse.ai");
  assert.equal(ipv4.baseUrl, "http://127.0.0.1:4312");
  assert.equal(localhost.baseUrl, "https://localhost:4312");
  assert.equal(ipv6.baseUrl, "http://[::1]:4312");
});

test("Platform config rejects non-HTTPS official and unapproved custom origins", () => {
  assert.throws(
    () => getPlatformConfig({
      PIXVERSE_PLATFORM_API_KEY: "fixture",
      PIXVERSE_PLATFORM_BASE_URL: "http://app-api.pixverse.ai",
    }),
    /official HTTPS origin|custom base URL/i,
  );
  assert.throws(
    () => getPlatformConfig({
      PIXVERSE_PLATFORM_API_KEY: "fixture",
      PIXVERSE_PLATFORM_BASE_URL: "https://proxy.example.test",
    }),
    /PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL=true/,
  );
});

test("Platform config requires the exact provider-specific opt-in for custom origins", () => {
  assert.throws(
    () => getPlatformConfig({
      PIXVERSE_PLATFORM_API_KEY: "fixture",
      PIXVERSE_PLATFORM_BASE_URL: "https://proxy.example.test",
      PIXVERSE_GROWTH_ALLOW_CUSTOM_BASE_URL: "true",
    }),
    /PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL=true/,
  );

  const config = getPlatformConfig({
    PIXVERSE_PLATFORM_API_KEY: "fixture",
    PIXVERSE_PLATFORM_BASE_URL: "https://proxy.example.test/",
    PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL: "true",
  });
  assert.equal(config.baseUrl, "https://proxy.example.test");
});

test("Platform config rejects malformed base URLs", () => {
  assert.throws(
    () => getPlatformConfig({ PIXVERSE_PLATFORM_API_KEY: "fixture" }, { baseUrl: "not-a-url" }),
    /valid HTTP.*URL/i,
  );
});
