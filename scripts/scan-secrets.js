#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectJavaScriptFiles } from "./check-syntax.js";

const EXTRA_FILES = [
  ".env.example",
  "README.md",
  "package.json",
  "package-lock.json",
];

const EXTRA_DIRS = [
  ".agents",
  "docs/api",
  "docs/superpowers",
];

const SECRET_PATTERNS = [
  {
    name: "Growth Studio live key",
    pattern: /mh_live_[A-Za-z0-9_-]{8,}/g,
    allowed: /mh_live_(?:REPLACE|\.\.\.|[A-Za-z0-9_-]*(?:fixture|example|placeholder))/i,
  },
  {
    name: "Platform API key",
    pattern: /PIXVERSE_PLATFORM_API_KEY\s*[:=]\s*["']?([^"'\s,}]+)/gi,
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
      findings.push({ file: filePath, name });
    }
  }
  return findings;
}

export async function collectScannableFiles(rootDir = process.cwd()) {
  const files = new Set(await collectJavaScriptFiles(rootDir));
  for (const file of EXTRA_FILES) {
    const fullPath = path.join(rootDir, file);
    if (await exists(fullPath)) files.add(fullPath);
  }
  for (const dir of EXTRA_DIRS) {
    const fullPath = path.join(rootDir, dir);
    if (await exists(fullPath)) {
      for (const file of await collectTextFiles(fullPath)) files.add(file);
    }
  }
  return [...files].sort();
}

export async function scanFiles(rootDir = process.cwd()) {
  const findings = [];
  for (const file of await collectScannableFiles(rootDir)) {
    findings.push(...scanTextForSecrets(file, await fs.readFile(file, "utf8")));
  }
  return findings;
}

async function collectTextFiles(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(fullPath));
    else if (entry.isFile() && /\.(?:md|json|txt|js)$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
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
  const findings = await scanFiles(process.cwd());
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${path.relative(process.cwd(), finding.file)}: ${finding.name}`);
    }
    process.exitCode = 1;
  }
}
