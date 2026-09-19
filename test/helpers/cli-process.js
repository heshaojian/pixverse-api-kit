import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? REPOSITORY_ROOT,
      env: { ...withoutPixverseApiKeys(process.env), ...options.env },
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

function withoutPixverseApiKeys(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !/^PIXVERSE_.*API_KEY$/.test(name)),
  );
}
