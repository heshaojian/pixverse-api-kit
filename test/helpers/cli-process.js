import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAFE_CHILD_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "pixverse-cli-process-"));

export function runCli(args = [], options = {}) {
  return runNode([path.join(REPOSITORY_ROOT, "src/cli.js"), ...args], options);
}

export function importCli(options = {}) {
  return runNode([
    "--input-type=module",
    "--eval",
    `await import(${JSON.stringify(path.join(REPOSITORY_ROOT, "src/cli.js"))})`,
  ], options);
}

function runNode(args, options) {
  const childEnv = { ...withoutPixverseSecrets(process.env), ...options.env };
  assertLoopbackProviderUrls(options.env ?? {});
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? SAFE_CHILD_CWD,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal, stdout, stderr }));
  });
}

function withoutPixverseSecrets(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !/^PIXVERSE_.*(?:API_KEY|TOKEN|SECRET)$/i.test(name)),
  );
}

function assertLoopbackProviderUrls(overrides) {
  for (const [name, value] of Object.entries(overrides)) {
    if (/^PIXVERSE_.*_BASE_URL$/i.test(name) && value && !isLoopbackUrl(value)) {
      throw new Error(`${name} must use a loopback URL in child CLI tests.`);
    }
  }

  const providers = [
    ["PIXVERSE_PLATFORM_API_KEY", "PIXVERSE_PLATFORM_BASE_URL"],
    ["PIXVERSE_GROWTH_API_KEY", "PIXVERSE_GROWTH_BASE_URL"],
    ["PIXVERSE_GROWTH_FOLDER_API_KEY", "PIXVERSE_GROWTH_BASE_URL"],
  ];
  for (const [credentialName, baseUrlName] of providers) {
    if (overrides[credentialName] && !isLoopbackUrl(overrides[baseUrlName])) {
      throw new Error(`${credentialName} requires an explicit loopback ${baseUrlName} in child CLI tests.`);
    }
  }
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
