#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getTopLevelHelp, isHelpRequest } from "./cli/options.js";
import { formatError, formatSuccess } from "./cli/output.js";
import { routeCommand } from "./cli/router.js";

const LEGACY_WARNING = 'Warning: legacy command syntax is deprecated; use the "pixverse-api growth-studio" namespace.\n';

export async function main(argv = [], context = {}) {
  const stdout = context.stdout ?? process.stdout;
  const stderr = context.stderr ?? process.stderr;

  if (isHelpRequest(argv)) {
    stdout.write(`${getTopLevelHelp()}\n`);
    return 0;
  }

  const route = routeCommand(argv);
  const providerContext = createProviderContext(context);

  try {
    if (route.provider === "growth-studio") {
      if (isHelpRequest(route.providerArgs)) {
        const { getGrowthStudioHelp } = await import("./growth-studio/cli.js");
        stdout.write(`${getGrowthStudioHelp()}\n`);
        return 0;
      }
      if (route.legacy) {
        stderr.write(LEGACY_WARNING);
      }
      const runGrowthStudio = context.runGrowthStudioCommand ?? runDefaultGrowthStudioCommand;
      stdout.write(formatSuccess(await runGrowthStudio(route.providerArgs, providerContext)));
      return 0;
    }

    if (route.provider === "platform") {
      if (isHelpRequest(route.providerArgs)) {
        const { getPlatformHelp } = await import("./platform/cli.js");
        stdout.write(`${getPlatformHelp()}\n`);
        return 0;
      }
      const runPlatform = context.runPlatformCommand ?? runDefaultPlatformCommand;
      stdout.write(formatSuccess(await runPlatform(route.providerArgs, providerContext)));
      return 0;
    }

    throw new Error(`Unknown provider or command: ${route.command || argv.join(" ")}`);
  } catch (error) {
    stderr.write(formatError(error));
    return 1;
  }
}

function createProviderContext(context) {
  return {
    env: context.env ?? process.env,
    fetchImpl: context.fetchImpl ?? globalThis.fetch,
    stdout: context.stdout ?? process.stdout,
    stderr: context.stderr ?? process.stderr,
    cwd: context.cwd ?? process.cwd(),
    sleep: context.sleep,
    now: context.now,
    inspectLocalMedia: context.inspectLocalMedia,
    signal: context.signal,
  };
}

async function runDefaultPlatformCommand(args, context) {
  if (context.env === process.env) {
    loadPlatformDotEnv(path.join(context.cwd, ".env"));
  }
  const { runPlatformCommand } = await import("./platform/cli.js");
  return runPlatformCommand(args, context);
}

function loadPlatformDotEnv(filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!stats.isFile()) return;

  const allowed = new Set(["PIXVERSE_PLATFORM_API_KEY", "PIXVERSE_PLATFORM_BASE_URL"]);
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!allowed.has(key) || process.env[key]) continue;
    const rawValue = trimmed.slice(separator + 1).trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

async function runDefaultGrowthStudioCommand(args, context) {
  if (context.env === process.env) {
    const { loadDotEnv } = await import("./growth-studio/config.js");
    loadDotEnv(path.join(context.cwd, ".env"));
  }
  const { runGrowthStudioCommand } = await import("./growth-studio/cli.js");
  return runGrowthStudioCommand(args, context);
}

function isExecutedDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
