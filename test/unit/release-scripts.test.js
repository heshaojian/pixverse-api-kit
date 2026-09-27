import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { collectJavaScriptFiles } from "../../scripts/check-syntax.js";
import { assertSafeTestNetworkTarget } from "../../scripts/no-paid-network.js";
import {
  collectScannableFiles,
  scanFiles,
  scanTextForSecrets,
} from "../../scripts/scan-secrets.js";

const execFileAsync = promisify(execFile);

test("syntax walker covers nested source and test JavaScript", async () => {
  const files = await collectJavaScriptFiles(process.cwd());
  assert.ok(files.some((file) => file.endsWith("src/platform/webhooks.js")));
  assert.ok(files.some((file) => file.endsWith("test/e2e/platform-webhook.e2e.test.js")));
  assert.ok(files.some((file) => file.endsWith("scripts/customer-plugin/archive.js")));
  assert.ok(files.some((file) => file.endsWith("scripts/package-customer-plugin.js")));
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

test("secret scanner covers every tracked text surface, ignores untracked and binary files, and redacts findings", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-secret-scan-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "deploy"), { recursive: true });
  await fs.mkdir(path.join(root, "payloads"), { recursive: true });
  await fs.mkdir(path.join(root, "pixverse-cli-jobs", "sample"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "tracked-package"), { recursive: true });
  await fs.writeFile(path.join(root, ".env"), "PIXVERSE_GROWTH_API_KEY=" + "mh_" + "live_never_print_this\n");
  await fs.writeFile(path.join(root, "deploy", "index.html"), "<p>safe</p>\nAuthorization: Bearer " + "deploysecret123456\n");
  await fs.writeFile(path.join(root, "payloads", "request.json"), "{\n  \"PIXVERSE_PLATFORM_API_KEY\": \"" + "payload_secret_123456" + "\"\n}\n");
  await fs.writeFile(path.join(root, "pixverse-cli-jobs", "sample", "response.json"), "safe\n" + "mh_" + "live_jobsecret123456\n");
  await fs.writeFile(path.join(root, "binary.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0x6d, 0x68, 0x5f, 0x6c, 0x69, 0x76, 0x65, 0x5f, 0x78]));
  await fs.writeFile(path.join(root, "node_modules", "tracked-package", "index.js"), "const key = '" + "mh_" + "live_dependencysecret';\n");

  await execFileAsync("git", ["init", "--quiet"], { cwd: root });
  await execFileAsync("git", ["add", "deploy/index.html", "payloads/request.json", "pixverse-cli-jobs/sample/response.json", "binary.png", "node_modules/tracked-package/index.js"], { cwd: root });

  const scannable = await collectScannableFiles(root);
  assert.equal(scannable.includes(path.join(root, ".env")), false);
  assert.equal(scannable.includes(path.join(root, "deploy", "index.html")), true);
  assert.equal(scannable.includes(path.join(root, "payloads", "request.json")), true);
  assert.equal(scannable.includes(path.join(root, "pixverse-cli-jobs", "sample", "response.json")), true);
  assert.equal(scannable.includes(path.join(root, "binary.png")), false);
  assert.equal(scannable.includes(path.join(root, "node_modules", "tracked-package", "index.js")), false);

  const first = await scanFiles(root);
  const second = await scanFiles(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(({ file, line, name }) => [path.relative(root, file), line, name]), [
    ["deploy/index.html", 2, "Bearer token"],
    ["payloads/request.json", 2, "Platform API key"],
    ["pixverse-cli-jobs/sample/response.json", 2, "Growth Studio live key"],
  ]);
  assert.equal(JSON.stringify(first).includes("never_print_this"), false);
  assert.equal(first.every((finding) => !("value" in finding)), true);
});

test("default tests are hermetic and pitch production lives outside API Kit", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../../package.json", import.meta.url), "utf8"));
  const rootApiTests = [
    "test/client.test.js",
    "test/folders.test.js",
    "test/jobs.test.js",
    "test/platform-skill.test.js",
  ];
  const removedScripts = [
    "compare:revolve",
    "test:pitches",
    "test:revolve-pdp-review",
    "test:revolve-pdp-review:coverage",
    "test:vips-pitch:coverage",
  ];
  const removedPaths = [
    "deploy/brand-pitches",
    "docs/brand-pitches",
    "payloads",
    "pixverse-cli-jobs",
    "qa/revolve-v3-v4-comparison",
  ];

  assert.equal(packageJson.scripts.test, "npm run test:api");
  assert.match(packageJson.scripts["test:api"], /--import \.\/scripts\/no-paid-network\.js/);
  for (const file of rootApiTests) {
    assert.match(packageJson.scripts["test:api"], new RegExp(file.replaceAll(".", "\\.")));
    assert.match(packageJson.scripts["test:coverage"], new RegExp(file.replaceAll(".", "\\.")));
  }
  for (const script of removedScripts) assert.equal(packageJson.scripts[script], undefined, script);
  const { stdout: trackedPitchFiles } = await execFileAsync("git", ["ls-files", "--", ...removedPaths], {
    cwd: process.cwd(),
  });
  assert.equal(trackedPitchFiles.trim(), "");
});

test("CI runs credential-free release gates", async () => {
  const workflow = await fs.readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test:coverage/);
  assert.match(workflow, /npm run security:scan/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.doesNotMatch(workflow, /PIXVERSE_(?:PLATFORM|GROWTH)_API_KEY/);
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
    "test/unit/growth-studio-compatibility.test.js",
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
