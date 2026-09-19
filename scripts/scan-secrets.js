#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const EXCLUDED_PATH_SEGMENTS = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
]);

const BINARY_EXTENSIONS = new Set([
  ".avi", ".gif", ".gz", ".ico", ".jpeg", ".jpg", ".m4a", ".mov",
  ".mp3", ".mp4", ".otf", ".pdf", ".png", ".tar", ".ttf", ".wav",
  ".webm", ".webp", ".woff", ".woff2", ".zip",
]);

const SECRET_PATTERNS = [
  {
    name: "Growth Studio live key",
    pattern: /mh_live_[A-Za-z0-9_-]{8,}/g,
    allowed: /mh_live_(?:REPLACE|\.\.\.|[A-Za-z0-9_-]*(?:fixture|example|placeholder))/i,
  },
  {
    name: "Platform API key",
    pattern: /["']?PIXVERSE_PLATFORM_API_KEY["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi,
    allowed: /(?:<|\[REDACTED\]|REPLACE|\.\.\.|(?:[A-Za-z0-9_-]*[-_])?(?:fixture|example|placeholder|test-key)|["']?(?:platform-|environment-key)$|:\s*[A-Z][A-Z0-9_]*$)/i,
  },
  {
    name: "API-KEY header",
    pattern: /["']?API-KEY["']?\s*[:=]\s*["']?([^"'\s,}]+)/gi,
    allowed: /(?:<|\[REDACTED\]|REPLACE|\.\.\.|["'](?:top-)?secret["']?$|["']?nope["']?$)/i,
  },
  {
    name: "Bearer token",
    pattern: /["']?Authorization["']?\s*:\s*["']?Bearer\s+([^"'\s,}]+)/gi,
    allowed: /(?:<|\[REDACTED\]|REPLACE|\.\.\.|Bearer\s+(?:secret|nope|[A-Za-z0-9_-]*fixture))/i,
  },
  {
    name: "Private key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    allowed: /PLACEHOLDER|EXAMPLE/,
  },
];

export function scanTextForSecrets(filePath, text) {
  const findings = [];
  for (const { name, pattern, allowed } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (allowed.test(value)) continue;
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ file: filePath, line, name });
    }
  }
  return findings;
}

export async function collectScannableFiles(rootDir = process.cwd()) {
  const resolvedRoot = path.resolve(rootDir);
  const { stdout } = await execFileAsync(
    "git",
    ["-C", resolvedRoot, "ls-files", "-z", "--cached"],
    { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 },
  );
  const trackedPaths = stdout.toString("utf8").split("\0").filter(Boolean).sort();
  const files = [];

  for (const trackedPath of trackedPaths) {
    if (hasExcludedSegment(trackedPath)) continue;
    const fullPath = path.resolve(resolvedRoot, trackedPath);
    if (!fullPath.startsWith(`${resolvedRoot}${path.sep}`)) continue;
    if (await isTrackedTextFile(fullPath)) files.push(fullPath);
  }
  return files;
}

export async function scanFiles(rootDir = process.cwd()) {
  const findings = [];
  for (const file of await collectScannableFiles(rootDir)) {
    findings.push(...scanTextForSecrets(file, await fs.readFile(file, "utf8")));
  }
  return findings;
}

function hasExcludedSegment(filePath) {
  return filePath.split(/[\\/]/).some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

async function isTrackedTextFile(filePath) {
  if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false;
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;

    const handle = await fs.open(filePath, "r");
    try {
      const sample = Buffer.alloc(Math.min(stat.size, 8192));
      const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
      return !sample.subarray(0, bytesRead).includes(0);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

function isExecutedDirectly() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const findings = await scanFiles(process.cwd());
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${path.relative(process.cwd(), finding.file)}:${finding.line}: ${finding.name}`);
    }
    process.exitCode = 1;
  }
}
