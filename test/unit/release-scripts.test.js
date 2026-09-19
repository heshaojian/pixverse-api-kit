import assert from "node:assert/strict";
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectJavaScriptFiles } from "../../scripts/check-syntax.js";
import { assertSafeTestNetworkTarget } from "../../scripts/no-paid-network.js";
import {
  collectScannableFiles,
  scanFiles,
  scanTextForSecrets,
} from "../../scripts/scan-secrets.js";

test("syntax walker covers nested source and test JavaScript", async () => {
  const files = await collectJavaScriptFiles(process.cwd());
  assert.ok(files.some((file) => file.endsWith("src/platform/webhooks.js")));
  assert.ok(files.some((file) => file.endsWith("test/e2e/platform-webhook.e2e.test.js")));
  assert.ok(files.every((file) => file.endsWith(".js")));
});

test("secret scanner rejects representative credentials and allows placeholders", () => {
  const blocked = [
    "PIXVERSE_GROWTH_API_KEY=" + "mh_" + "live_1234567890abcdef",
    "PIXVERSE_PLATFORM_API_KEY=" + "platform_live_1234567890abcdef",
    'headers = { "API-' + 'KEY": "platform_live_1234567890" }',
    'headers = { "Authoriz' + 'ation": "Bearer abcdef1234567890" }',
    "-----BEGIN " + "PRIVATE KEY-----",
  ];
  for (const text of blocked) {
    assert.notEqual(scanTextForSecrets("fixture.txt", text).length, 0, text);
  }

  const allowed = [
    "PIXVERSE_GROWTH_API_KEY=mh_live_REPLACE_WITH_PRODUCTION_API_KEY",
    "PIXVERSE_GROWTH_API_KEY=mh_live_...",
    "API-KEY: <PIXVERSE_PLATFORM_API_KEY>",
    "Authorization: Bearer <PIXVERSE_GROWTH_API_KEY>",
    "\"API-KEY\": \"[REDACTED]\"",
  ];
  for (const text of allowed) {
    assert.deepEqual(scanTextForSecrets("fixture.txt", text), [], text);
  }
});

test("secret scanner excludes ignored dotenv secrets and returns deterministic redacted findings", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-secret-scan-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(path.join(root, ".env"), "PIXVERSE_GROWTH_API_KEY=" + "mh_" + "live_never_print_this\n");
  await fs.writeFile(path.join(root, ".env.example"), "PIXVERSE_GROWTH_API_KEY=mh_live_REPLACE_WITH_PRODUCTION_API_KEY\n");
  await fs.writeFile(path.join(root, "src", "b.js"), "const token = '" + "mh_" + "live_bbbbbbbbbbbb';\n");
  await fs.writeFile(path.join(root, "src", "a.js"), "const token = '" + "mh_" + "live_aaaaaaaaaaaa';\n");

  const scannable = await collectScannableFiles(root);
  assert.equal(scannable.includes(path.join(root, ".env")), false);
  assert.equal(scannable.includes(path.join(root, ".env.example")), true);

  const first = await scanFiles(root);
  const second = await scanFiles(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(({ file, name }) => [path.relative(root, file), name]), [
    ["src/a.js", "Growth Studio live key"],
    ["src/b.js", "Growth Studio live key"],
  ]);
  assert.equal(JSON.stringify(first).includes("never_print_this"), false);
  assert.equal(first.every((finding) => !("value" in finding)), true);
});

test("release targets enforce the no-paid-network guard without banning config assertions", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["test:api"], /--import \.\/scripts\/no-paid-network\.js/);
  assert.match(packageJson.scripts["test:coverage"], /--import \.\/scripts\/no-paid-network\.js/);
  assert.match(packageJson.scripts["test:api"], /test\/no-paid-network\.test\.js/);

  const files = await collectJavaScriptFiles(process.cwd());
  const executableTests = files.filter((file) => /\/test\/(unit|contract|integration|e2e)\//.test(file));
  const productionHostFiles = [];
  for (const file of executableTests) {
    const text = await fs.readFile(file, "utf8");
    const relativeFile = path.relative(process.cwd(), file);
    if (/https:\/\/(?:app-api|growth-api)\.pixverse\.ai/.test(text)) {
      productionHostFiles.push(relativeFile);
    }
    if (relativeFile === "test/unit/release-scripts.test.js") continue;
    assert.doesNotMatch(
      text,
      /(?:fetch|https?\.request)\s*\(\s*["'`]https:\/\/(?:app-api|growth-api)\.pixverse\.ai/,
      file,
    );

    if (/\bfetch\s*\(/.test(text)) {
      assert.match(text, /createMockApiServer|startPlatformWebhookServer|startHandler/, `${file} must fetch only from a local test server`);
    }
  }
  assert.deepEqual(productionHostFiles, [
    "test/unit/platform-config.test.js",
    "test/unit/release-scripts.test.js",
  ]);

  const configTest = await fs.readFile(new URL("../unit/platform-config.test.js", import.meta.url), "utf8");
  assert.match(configTest, /DEFAULT_PLATFORM_BASE_URL, "https:\/\/app-api\.pixverse\.ai"/);

  const guardTest = await fs.readFile(new URL("../no-paid-network.test.js", import.meta.url), "utf8");
  assert.match(packageJson.scripts["test:api"], /test\/no-paid-network\.test\.js/);
  assert.match(guardTest, /strip ambient PixVerse API keys/);
  assert.match(guardTest, /reject credentials without an explicit loopback provider URL/);
  assert.match(guardTest, /reject provider credentials loaded from an unsafe cwd dotenv/);
  assert.match(guardTest, /requires an explicit loopback PIXVERSE_PLATFORM_BASE_URL/);
  assert.match(guardTest, /must use a loopback URL/);
});

test("process-level network guard blocks PixVerse production hosts and allows local mocks", () => {
  for (const target of [
    "https://app-api.pixverse.ai/openapi/v2/account/balance",
    new URL("https://growth-api.pixverse.ai/v1/videos"),
    { hostname: "app-api.pixverse.ai", protocol: "https:", path: "/openapi/v2/video" },
  ]) {
    assert.throws(() => assertSafeTestNetworkTarget(target), /blocked PixVerse production network access/);
  }

  for (const target of [
    "http://127.0.0.1:1234/mock",
    new URL("http://localhost:4321/mock"),
    { hostname: "::1", protocol: "http:", port: 9876 },
    "https://example.test/mock",
  ]) {
    assert.doesNotThrow(() => assertSafeTestNetworkTarget(target));
  }

  assert.throws(
    () => globalThis.fetch("https://app-api.pixverse.ai/openapi/v2/account/balance"),
    /blocked PixVerse production network access/,
  );
  assert.throws(
    () => https.request("https://growth-api.pixverse.ai/v1/videos"),
    /blocked PixVerse production network access/,
  );
});

test("process-level network guard has no normal-test opt-out", async () => {
  const source = await fs.readFile(new URL("../../scripts/no-paid-network.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /process\.env|ALLOW_PAID|DISABLE_GUARD|SKIP_GUARD/);
});
