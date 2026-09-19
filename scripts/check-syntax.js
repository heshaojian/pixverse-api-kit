#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_DIRS = ["src", "scripts", "qa", "test"];

export async function collectJavaScriptFiles(rootDir = process.cwd(), dirs = DEFAULT_DIRS) {
  const files = [];
  for (const dir of dirs) {
    const start = path.join(rootDir, dir);
    if (!(await exists(start))) continue;
    await collectFromDirectory(start, files);
  }
  return files.sort();
}

export async function checkSyntax(rootDir = process.cwd()) {
  const files = await collectJavaScriptFiles(rootDir);
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: rootDir,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures.push({ file, output: `${result.stdout}${result.stderr}`.trim() });
    }
  }
  return failures;
}

async function collectFromDirectory(dir, files) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectFromDirectory(fullPath, files);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(fullPath);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isExecutedDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const failures = await checkSyntax(process.cwd());
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`${path.relative(process.cwd(), failure.file)}\n${failure.output}`);
    }
    process.exitCode = 1;
  }
}
