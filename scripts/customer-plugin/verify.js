import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { scanTextForSecrets } from "../scan-secrets.js";
import {
  CUSTOMER_PLUGIN_DENIED_PATHS,
  CUSTOMER_PLUGIN_RELEASE,
} from "./config.js";

const execFileAsync = promisify(execFile);
const TEXT_BINARY_EXTENSIONS = new Set([
  ".gif", ".gz", ".ico", ".jpeg", ".jpg", ".mov", ".mp3", ".mp4",
  ".png", ".tar", ".wav", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);
const DENIED_CONTENT = Object.freeze([
  { name: "internal absolute path", pattern: /\/Users\//i },
  { name: "private document URL", pattern: /(?:aisphere\.)?feishu\.cn/i },
  { name: "internal design path", pattern: /docs\/superpowers|docs\/brand-pitches/i },
  { name: "customer-specific content", pattern: /\b(?:revolve|plaud|vips|zeelool|vooglam)\b/i },
  { name: "generated media URL", pattern: /https:\/\/media\.pixverse\.ai\/pixverse\//i },
]);

export async function verifyCustomerPlugin({ packageRoot, pluginValidatorPath } = {}) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const entries = await collectPackageEntries(resolvedPackageRoot);
  validatePaths(entries);
  await validateTextContent(resolvedPackageRoot, entries);
  const { marketplace, plugin, pluginRoot } = await validateManifests(resolvedPackageRoot);
  await validateSkills(pluginRoot);
  await validateRuntimeSyntax(entries);
  await validateWrapper(pluginRoot);
  if (pluginValidatorPath) {
    await runOfficialPluginValidator(pluginValidatorPath, pluginRoot);
  }

  const checks = Object.freeze([
    Object.freeze({ name: "inventory", status: "passed" }),
    Object.freeze({ name: "content-safety", status: "passed" }),
    Object.freeze({ name: "codex-manifests", status: "passed" }),
    Object.freeze({ name: "skills", status: "passed" }),
    Object.freeze({ name: "runtime-syntax", status: "passed" }),
    Object.freeze({ name: "embedded-cli", status: "passed" }),
  ]);
  return Object.freeze({
    status: "passed",
    files: Object.freeze(entries.filter(({ type }) => type === "file").map(({ relativePath }) => relativePath)),
    checks,
    marketplace: Object.freeze({ name: marketplace.name }),
    plugin: Object.freeze({ name: plugin.name, version: plugin.version }),
  });
}

export async function collectPackageEntries(packageRoot) {
  return collectEntries(path.resolve(packageRoot), path.resolve(packageRoot));
}

async function collectEntries(root, current) {
  const directoryEntries = await fs.readdir(current, { withFileTypes: true });
  const nested = await Promise.all(directoryEntries
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
      const stats = await fs.lstat(fullPath);
      if (stats.isSymbolicLink()) {
        return [Object.freeze({ fullPath, relativePath, type: "symlink", mode: stats.mode })];
      }
      if (stats.isDirectory()) {
        const children = await collectEntries(root, fullPath);
        return [Object.freeze({ fullPath, relativePath, type: "directory", mode: stats.mode }), ...children];
      }
      if (stats.isFile()) {
        return [Object.freeze({ fullPath, relativePath, type: "file", mode: stats.mode })];
      }
      return [Object.freeze({ fullPath, relativePath, type: "unsupported", mode: stats.mode })];
    }));
  return nested.flat().toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function validatePaths(entries) {
  for (const entry of entries) {
    if (entry.type === "symlink") throw new Error(`Package symlink is not allowed: ${entry.relativePath}`);
    if (entry.type === "unsupported") throw new Error(`Unsupported package entry: ${entry.relativePath}`);
    if (isDeniedPath(entry.relativePath)) throw new Error(`Package contains forbidden path: ${entry.relativePath}`);
    if (!isAllowedTopLevelPath(entry.relativePath)) {
      throw new Error(`Package contains unapproved top-level path: ${entry.relativePath}`);
    }
  }
}

function isDeniedPath(relativePath) {
  const normalized = relativePath.toLowerCase();
  return CUSTOMER_PLUGIN_DENIED_PATHS.some((denied) => {
    const normalizedDenied = denied.toLowerCase();
    return normalized === normalizedDenied
      || normalized.startsWith(`${normalizedDenied}/`)
      || normalized.includes(`/${normalizedDenied}/`)
      || normalized.endsWith(`/${normalizedDenied}`);
  });
}

function isAllowedTopLevelPath(relativePath) {
  const [topLevel] = relativePath.split("/");
  return topLevel === ".agents"
    || topLevel === "INSTALL-MACOS.md"
    || topLevel === "Install PixVerse API Plugin.command"
    || topLevel === "Uninstall PixVerse API Plugin.command"
    || topLevel === "MANIFEST.sha256"
    || topLevel === "plugins";
}

async function validateTextContent(packageRoot, entries) {
  for (const entry of entries) {
    if (entry.type !== "file" || TEXT_BINARY_EXTENSIONS.has(path.extname(entry.relativePath).toLowerCase())) continue;
    const buffer = await fs.readFile(entry.fullPath);
    if (buffer.subarray(0, 8192).includes(0)) continue;
    const text = buffer.toString("utf8");
    const secretFindings = scanTextForSecrets(entry.relativePath, text);
    if (secretFindings.length > 0) {
      throw new Error(`Package secret pattern detected: ${entry.relativePath}:${secretFindings[0].line}`);
    }
    for (const rule of DENIED_CONTENT) {
      if (rule.pattern.test(text)) {
        throw new Error(`Package ${rule.name} detected: ${path.relative(packageRoot, entry.fullPath)}`);
      }
    }
  }
}

async function validateManifests(packageRoot) {
  const marketplace = await readJson(
    path.join(packageRoot, ".agents", "plugins", "marketplace.json"),
    "marketplace manifest",
  );
  if (marketplace.name !== CUSTOMER_PLUGIN_RELEASE.marketplaceName) {
    throw new Error("Codex marketplace name does not match the release configuration.");
  }
  const marketplacePlugin = marketplace.plugins?.[0];
  if (marketplace.plugins?.length !== 1 || marketplacePlugin?.name !== CUSTOMER_PLUGIN_RELEASE.pluginName) {
    throw new Error("Codex marketplace must contain exactly the PixVerse API plugin.");
  }
  if (marketplacePlugin?.source?.source !== "local" || marketplacePlugin?.source?.path !== "./plugins/pixverse-api") {
    throw new Error("Codex marketplace plugin source is invalid.");
  }
  if (marketplacePlugin?.policy?.installation !== "AVAILABLE"
      || marketplacePlugin?.policy?.authentication !== "ON_INSTALL") {
    throw new Error("Codex marketplace policy is invalid.");
  }

  const pluginRoot = path.join(packageRoot, "plugins", CUSTOMER_PLUGIN_RELEASE.pluginName);
  const plugin = await readJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "plugin manifest");
  if (plugin.name !== CUSTOMER_PLUGIN_RELEASE.pluginName) {
    throw new Error("Codex plugin manifest name is invalid.");
  }
  if (plugin.version !== CUSTOMER_PLUGIN_RELEASE.version) {
    throw new Error("Codex plugin manifest version is invalid.");
  }
  if (plugin.skills !== "./skills/" || plugin.author?.name !== "PixVerse") {
    throw new Error("Codex plugin manifest metadata is invalid.");
  }
  if (plugin.mcpServers || plugin.apps || plugin.hooks) {
    throw new Error("Codex plugin declares an unsupported component.");
  }
  return Object.freeze({ marketplace, plugin, pluginRoot });
}

async function validateSkills(pluginRoot) {
  const skillsRoot = path.join(pluginRoot, "skills");
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).toSorted();
  const expected = ["growth-studio", "platform", "start"];
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Codex plugin skills must be exactly: ${expected.join(", ")}.`);
  }
  for (const name of names) {
    const text = await fs.readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    if (!new RegExp(`^---\\nname: ${name}\\n`, "m").test(text)) {
      throw new Error(`Codex skill frontmatter is invalid: ${name}.`);
    }
  }
}

async function validateWrapper(pluginRoot) {
  const wrapperPath = path.join(pluginRoot, "scripts", "pixverse-api");
  const stats = await fs.stat(wrapperPath);
  if ((stats.mode & 0o100) === 0) throw new Error("PixVerse API wrapper must be executable.");

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("PIXVERSE_")),
  );
  const invocations = [
    ["--version"],
    ["--help"],
    ["platform", "--help"],
    ["growth-studio", "--help"],
  ];
  for (const args of invocations) {
    await execFileAsync(wrapperPath, args, {
      cwd: pluginRoot,
      env,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
  }
}

async function validateRuntimeSyntax(entries) {
  const runtimeJavaScript = entries.filter(({ type, relativePath }) => type === "file"
    && relativePath.startsWith("plugins/pixverse-api/runtime/src/")
    && relativePath.endsWith(".js"));
  for (const entry of runtimeJavaScript) {
    await execFileAsync(process.execPath, ["--check", entry.fullPath], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
  }
}

async function runOfficialPluginValidator(validatorPath, pluginRoot) {
  await execFileAsync(
    "uv",
    ["run", "--with", "pyyaml", "python", path.resolve(validatorPath), pluginRoot],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    throw new Error(`Unable to read valid ${label}: ${path.basename(filePath)}.`);
  }
}
