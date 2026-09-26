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
const macTest = process.platform === "darwin" ? test : test.skip;

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
    packageRoot: path.join(extractRoot, "pixverse-api-plugin-0.3.0-beta.2"),
  };
}

async function createFakeCodex(root) {
  const binRoot = path.join(root, "bin");
  const npmPrefix = path.join(root, "npm-prefix");
  const logPath = path.join(root, "codex-calls.jsonl");
  await fs.mkdir(binRoot, { recursive: true });
  await fs.mkdir(path.join(npmPrefix, "bin"), { recursive: true });
  const executable = `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CODEX_CALL_LOG, JSON.stringify(args) + "\\n");
if (process.env.FAKE_CODEX_ABSENT_ON && args.join(" ").includes(process.env.FAKE_CODEX_ABSENT_ON)) {
  process.stderr.write("Error: marketplace pixverse-private-beta is not configured or installed\\n");
  process.exit(1);
}
if (process.env.FAKE_CODEX_FAIL_ONCE && args.join(" ").includes(process.env.FAKE_CODEX_FAIL_ONCE)) {
  const statePath = process.env.FAKE_CODEX_STATE;
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, "failed once\\n");
    process.exit(9);
  }
}
if (process.env.FAKE_CODEX_FAIL_ON && args.join(" ").includes(process.env.FAKE_CODEX_FAIL_ON)) process.exit(9);
process.stdout.write(JSON.stringify({ ok: true }) + "\\n");
`;
  const codexPath = path.join(binRoot, "codex");
  await fs.writeFile(codexPath, executable, { mode: 0o755 });
  await fs.chmod(codexPath, 0o755);
  const npmExecutable = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "prefix" && args[1] === "-g") {
  process.stdout.write(${JSON.stringify(npmPrefix)} + "\\n");
  process.exit(0);
}
process.stderr.write("fake npm only supports: npm prefix -g\\n");
process.exit(1);
`;
  const npmPath = path.join(binRoot, "npm");
  await fs.writeFile(npmPath, npmExecutable, { mode: 0o755 });
  await fs.chmod(npmPath, 0o755);
  return { binRoot, logPath, npmPrefix };
}

function cleanEnvironment({ home, binRoot, logPath, extra = {} }) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PIXVERSE_"))),
    HOME: home,
    PATH: `${binRoot}:${process.env.PATH}`,
    CODEX_CALL_LOG: logPath,
    PIXVERSE_API_SKIP_PIXVERSE_PREFIX: "1",
    ...extra,
  };
}

async function readCalls(logPath) {
  const text = await fs.readFile(logPath, "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function createPixverseCliFixture(root, binRoot) {
  const pixversePrefix = path.dirname(binRoot);
  const pixversePackage = path.join(pixversePrefix, "lib/node_modules/pixverse");
  await fs.mkdir(path.join(pixversePackage, "dist"), { recursive: true });
  await fs.mkdir(path.join(pixversePrefix, "bin"), { recursive: true });
  await fs.writeFile(path.join(pixversePackage, "dist/index.js"), "#!/usr/bin/env node\n", { mode: 0o755 });
  await fs.symlink("../lib/node_modules/pixverse/dist/index.js", path.join(binRoot, "pixverse"));
  return pixversePrefix;
}

macTest("macOS helpers install and remove only receipt-owned plugin state", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  const env = cleanEnvironment({ home, binRoot, logPath });
  const installer = path.join(packageRoot, "install.command");
  const uninstaller = path.join(packageRoot, "uninstall.command");

  await execFileAsync("zsh", [installer], { env, encoding: "utf8" });

  const supportRoot = path.join(home, "Library/Application Support/PixVerse/api-plugin");
  const installRoot = path.join(npmPrefix, "lib/node_modules/pixverse-api");
  const binPath = path.join(npmPrefix, "bin/pixverse-api");
  const receiptPath = path.join(supportRoot, "install-receipt.json");
  assert.equal((await fs.stat(path.join(installRoot, ".agents/plugins/marketplace.json"))).isFile(), true);
  assert.equal((await fs.stat(path.join(installRoot, "dist/index.js"))).isFile(), true);
  assert.equal(await fs.readlink(binPath), "../lib/node_modules/pixverse-api/dist/index.js");
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
  await assert.rejects(fs.access(binPath), { code: "ENOENT" });
  await assert.rejects(fs.access(receiptPath), { code: "ENOENT" });
  assert.equal(await fs.readFile(unrelatedPath, "utf8"), "unrelated\n");
});

macTest("installer prefers the existing PixVerse CLI npm prefix", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath } = await createFakeCodex(root);
  await fs.mkdir(home);
  const pixversePrefix = await createPixverseCliFixture(root, binRoot);
  const installer = path.join(packageRoot, "install.command");

  await execFileAsync("zsh", [installer], {
    env: cleanEnvironment({
      home,
      binRoot,
      logPath,
      extra: { PIXVERSE_API_SKIP_PIXVERSE_PREFIX: "0" },
    }),
    encoding: "utf8",
  });

  const installRoot = path.join(pixversePrefix, "lib/node_modules/pixverse-api");
  const binPath = path.join(pixversePrefix, "bin/pixverse-api");
  assert.equal((await fs.stat(path.join(installRoot, "package.json"))).isFile(), true);
  assert.equal(await fs.readlink(binPath), "../lib/node_modules/pixverse-api/dist/index.js");
  assert.deepEqual(await readCalls(logPath), [
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
  ]);
});

macTest("failed Codex registration restores the previously installed version", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  const installer = path.join(packageRoot, "install.command");
  const successfulEnv = cleanEnvironment({ home, binRoot, logPath });
  await execFileAsync("zsh", [installer], { env: successfulEnv, encoding: "utf8" });

  const installRoot = path.join(npmPrefix, "lib/node_modules/pixverse-api");
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

macTest("installer rejects files that are not listed in the signed inventory", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  await fs.mkdir(path.join(packageRoot, "plugins/pixverse-api/skills/unlisted"), { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "plugins/pixverse-api/skills/unlisted/SKILL.md"),
    "unlisted content\n",
  );

  const installer = path.join(packageRoot, "install.command");
  await assert.rejects(
    execFileAsync("zsh", [installer], {
      env: cleanEnvironment({ home, binRoot, logPath }),
      encoding: "utf8",
    }),
  );

  await assert.rejects(fs.access(logPath), { code: "ENOENT" });
  await assert.rejects(
    fs.access(path.join(npmPrefix, "lib/node_modules/pixverse-api")),
    { code: "ENOENT" },
  );
});

macTest("uninstaller treats an already absent Codex registration as success", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  const installer = path.join(packageRoot, "install.command");
  const uninstaller = path.join(packageRoot, "uninstall.command");
  await execFileAsync("zsh", [installer], {
    env: cleanEnvironment({ home, binRoot, logPath }),
    encoding: "utf8",
  });

  await execFileAsync("zsh", [uninstaller], {
    env: cleanEnvironment({
      home,
      binRoot,
      logPath,
      extra: { FAKE_CODEX_ABSENT_ON: "plugin marketplace remove" },
    }),
    encoding: "utf8",
  });

  const supportRoot = path.join(home, "Library/Application Support/PixVerse/api-plugin");
  await assert.rejects(fs.access(path.join(npmPrefix, "lib/node_modules/pixverse-api")), { code: "ENOENT" });
  await assert.rejects(fs.access(path.join(supportRoot, "install-receipt.json")), { code: "ENOENT" });
});

macTest("plugin-add failure restores the prior files and Codex registration", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  const installer = path.join(packageRoot, "install.command");
  await execFileAsync("zsh", [installer], {
    env: cleanEnvironment({ home, binRoot, logPath }),
    encoding: "utf8",
  });

  const installRoot = path.join(npmPrefix, "lib/node_modules/pixverse-api");
  const markerPath = path.join(installRoot, "prior-install-marker.txt");
  await fs.writeFile(markerPath, "preserve prior install\n");

  await assert.rejects(
    execFileAsync("zsh", [installer], {
      env: cleanEnvironment({
        home,
        binRoot,
        logPath,
        extra: {
          FAKE_CODEX_FAIL_ONCE: "plugin add",
          FAKE_CODEX_STATE: path.join(root, "fail-once.state"),
        },
      }),
      encoding: "utf8",
    }),
  );

  assert.equal(await fs.readFile(markerPath, "utf8"), "preserve prior install\n");
  const calls = await readCalls(logPath);
  assert.deepEqual(calls.slice(-5), [
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
    ["plugin", "marketplace", "remove", "pixverse-private-beta", "--json"],
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
  ]);
});

macTest("new-version plugin-add failure restores the receipt-owned older version", async (t) => {
  const { root, packageRoot } = await createExtractedPackage(t);
  const home = path.join(root, "home");
  const { binRoot, logPath, npmPrefix } = await createFakeCodex(root);
  await fs.mkdir(home);
  const installer = path.join(packageRoot, "install.command");
  await execFileAsync("zsh", [installer], {
    env: cleanEnvironment({ home, binRoot, logPath }),
    encoding: "utf8",
  });

  const supportRoot = path.join(home, "Library/Application Support/PixVerse/api-plugin");
  const installRoot = path.join(npmPrefix, "lib/node_modules/pixverse-api");
  const olderInstallRoot = path.join(supportRoot, "0.2.0-beta.9");
  const receiptPath = path.join(supportRoot, "install-receipt.json");
  await fs.rename(installRoot, olderInstallRoot);
  await fs.writeFile(path.join(olderInstallRoot, "prior-install-marker.txt"), "older version\n");
  await fs.writeFile(receiptPath, `${JSON.stringify({
    install_root: olderInstallRoot,
    marketplace: "pixverse-private-beta",
    plugin: "pixverse-api",
    version: "0.2.0-beta.9",
  }, null, 2)}\n`, { mode: 0o600 });

  await assert.rejects(
    execFileAsync("zsh", [installer], {
      env: cleanEnvironment({
        home,
        binRoot,
        logPath,
        extra: {
          FAKE_CODEX_FAIL_ONCE: "plugin add",
          FAKE_CODEX_STATE: path.join(root, "upgrade-fail-once.state"),
        },
      }),
      encoding: "utf8",
    }),
  );

  assert.equal(
    await fs.readFile(path.join(olderInstallRoot, "prior-install-marker.txt"), "utf8"),
    "older version\n",
  );
  await assert.rejects(fs.access(installRoot), { code: "ENOENT" });
  const calls = await readCalls(logPath);
  assert.deepEqual(calls.slice(-5), [
    ["plugin", "marketplace", "add", installRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
    ["plugin", "marketplace", "remove", "pixverse-private-beta", "--json"],
    ["plugin", "marketplace", "add", olderInstallRoot, "--json"],
    ["plugin", "add", "pixverse-api@pixverse-private-beta", "--json"],
  ]);
});
