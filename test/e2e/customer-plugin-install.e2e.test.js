import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { archiveCustomerPlugin } from "../../scripts/customer-plugin/archive.js";
import { stageCustomerPlugin } from "../../scripts/customer-plugin/stage.js";

const execFileAsync = promisify(execFile);

async function createExtractedPackage(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pixverse-installer-e2e-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const stageRoot = path.join(root, "stage");
  const outputRoot = path.join(root, "output");
  const extractRoot = path.join(root, "extract");
  await fs.mkdir(stageRoot, { recursive: true });
  await fs.mkdir(extractRoot, { recursive: true });
  const staged = await stageCustomerPlugin({
    repoRoot: process.cwd(),
    stageRoot,
    installDependencies: true,
  });
  const archived = await archiveCustomerPlugin({ packageRoot: staged.packageRoot, outputDir: outputRoot });
  await execFileAsync("unzip", ["-q", archived.archivePath, "-d", extractRoot]);
  return {
    root,
    packageRoot: path.join(extractRoot, "pixverse-api-plugin-codex-0.3.0-beta.1"),
  };
}

async function createFakeCodex(root) {
  const binRoot = path.join(root, "bin");
  const logPath = path.join(root, "codex-calls.jsonl");
  await fs.mkdir(binRoot, { recursive: true });
  const executable = `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CODEX_CALL_LOG, JSON.stringify(args) + "\\n");
if (process.env.FAKE_CODEX_FAIL_ON && args.join(" ").includes(process.env.FAKE_CODEX_FAIL_ON)) process.exit(9);
process.stdout.write(JSON.stringify({ ok: true }) + "\\n");
`;
  const codexPath = path.join(binRoot, "codex");
  await fs.writeFile(codexPath, executable, { mode: 0o755 });
  await fs.chmod(codexPath, 0o755);
  return { binRoot, logPath };
}

function cleanEnvironment({ home, binRoot, logPath, extra = {} }) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PIXVERSE_"))),
    HOME: home,
    PATH: `${binRoot}:${process.env.PATH}`,
    CODEX_CALL_LOG: logPath,
    ...extra,
  };
}

async function readCalls(logPath) {
  const text = await fs.readFile(logPath, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("macOS helpers install and remove only receipt-owned plugin state", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath } = await createFakeCodex(root);
  await fs.mkdir(home);
  const env = cleanEnvironment({ home, binRoot, logPath });
  const installer = path.join(packageRoot, "Install PixVerse API Plugin.command");
  const uninstaller = path.join(packageRoot, "Uninstall PixVerse API Plugin.command");

  await execFileAsync("zsh", [installer], { env, encoding: "utf8" });

  const supportRoot = path.join(home, "Library/Application Support/PixVerse/API Plugin");
  const installRoot = path.join(supportRoot, "0.3.0-beta.1");
  const receiptPath = path.join(supportRoot, "install-receipt.json");
  assert.equal((await fs.stat(path.join(installRoot, "marketplace.json"))).isFile(), true);
  assert.equal((await fs.stat(receiptPath)).mode & 0o077, 0);
  assert.deepEqual(await readCalls(logPath), [
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
  ]);

  const unrelatedPath = path.join(supportRoot, "keep-this-file.txt");
  await fs.writeFile(unrelatedPath, "unrelated\n");
  await execFileAsync("zsh", [uninstaller], { env, encoding: "utf8" });

  assert.deepEqual(await readCalls(logPath), [
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
    ["plugin", "remove", "pixverse-api@pixverse-private-beta", "--json"],
    ["plugin", "marketplace", "remove", "pixverse-private-beta", "--json"],
  ]);
  await assert.rejects(fs.access(installRoot), { code: "ENOENT" });
  await assert.rejects(fs.access(receiptPath), { code: "ENOENT" });
  assert.equal(await fs.readFile(unrelatedPath, "utf8"), "unrelated\n");
});

test("failed Codex registration restores the previously installed version", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath } = await createFakeCodex(root);
  await fs.mkdir(home);
  const installer = path.join(packageRoot, "Install PixVerse API Plugin.command");
  const successfulEnv = cleanEnvironment({ home, binRoot, logPath });
  await execFileAsync("zsh", [installer], { env: successfulEnv, encoding: "utf8" });

  const installRoot = path.join(
    home,
    "Library/Application Support/PixVerse/API Plugin/0.3.0-beta.1",
  );
  const markerPath = path.join(installRoot, "prior-install-marker.txt");
  await fs.writeFile(markerPath, "preserve prior install\n");

  const failingEnv = cleanEnvironment({
    home,
    binRoot,
    logPath,
    extra: { FAKE_CODEX_FAIL_ON: "plugin marketplace add" },
  });

  await assert.rejects(
    execFileAsync("zsh", [installer], {
      env: failingEnv,
      encoding: "utf8",
    }),
  );
  assert.equal(await fs.readFile(markerPath, "utf8"), "preserve prior install\n");
});
