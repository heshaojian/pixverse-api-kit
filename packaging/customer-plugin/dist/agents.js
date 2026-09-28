#!/usr/bin/env node
// Registers an installed PixVerse API Plugin package with coding agents other than Codex.
// Codex registration stays in install.command so its transactional rollback is unchanged.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MARKETPLACE_NAME = "pixverse-private-beta";
export const CLAUDE_PLUGIN_ID = `pixverse-api@${MARKETPLACE_NAME}`;
export const OWNER_MARKER = ".pixverse-api-plugin";
export const STANDALONE_SKILLS = Object.freeze([
  "pixverse-api-growth-studio",
  "pixverse-api-platform",
  "pixverse-api-start",
]);

// Agents that load Agent Skills (SKILL.md folders) from a user-level directory.
// ~/.agents/skills is deliberately avoided because Codex also reads it and would
// load the skills twice beside the Codex plugin.
export const SKILL_AGENTS = Object.freeze([
  Object.freeze({ name: "gemini", label: "Gemini CLI", commands: ["gemini"], configDir: ".gemini", skillsDir: ".gemini/skills" }),
  Object.freeze({ name: "cursor", label: "Cursor", commands: ["cursor-agent", "cursor"], configDir: ".cursor", skillsDir: ".cursor/skills" }),
  Object.freeze({ name: "copilot", label: "GitHub Copilot CLI", commands: ["copilot"], configDir: ".copilot", skillsDir: ".copilot/skills" }),
  Object.freeze({ name: "opencode", label: "OpenCode", commands: ["opencode"], configDir: ".config/opencode", skillsDir: ".config/opencode/skills" }),
]);
export const AGENT_LABELS = Object.freeze({
  codex: "Codex",
  claude: "Claude Code",
  ...Object.fromEntries(SKILL_AGENTS.map((agent) => [agent.name, agent.label])),
});
export const AGENT_NAMES = Object.freeze(Object.keys(AGENT_LABELS));

export function findCommand(name, env = process.env) {
  for (const directory of (env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Keep searching PATH.
    }
  }
  return "";
}

export function detectAgents({ env = process.env, home = os.homedir() } = {}) {
  const detected = [];
  if (findCommand("codex", env)) detected.push("codex");
  if (findCommand("claude", env)) detected.push("claude");
  for (const agent of SKILL_AGENTS) {
    if (agent.commands.some((command) => findCommand(command, env))
        || fs.existsSync(path.join(home, agent.configDir))) {
      detected.push(agent.name);
    }
  }
  return detected;
}

// PIXVERSE_API_AGENTS is "auto" (default) or a comma-separated list such as "claude,cursor".
export function selectAgents({ requested = "auto", env = process.env, home = os.homedir() } = {}) {
  const value = String(requested ?? "").trim().toLowerCase();
  if (!value || value === "auto") return detectAgents({ env, home });

  const names = [...new Set(value.split(",").map((name) => name.trim()).filter(Boolean))];
  const unknown = names.filter((name) => !AGENT_NAMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown agent in PIXVERSE_API_AGENTS: ${unknown.join(", ")}. Supported: ${AGENT_NAMES.join(", ")}.`);
  }
  for (const name of ["codex", "claude"]) {
    if (names.includes(name) && !findCommand(name, env)) {
      throw new Error(`${AGENT_LABELS[name]} was requested, but the \`${name}\` command was not found.`);
    }
  }
  return AGENT_NAMES.filter((name) => names.includes(name));
}

export function installAgents({
  root,
  agents,
  previous = null,
  replace = false,
  env = process.env,
  home = os.homedir(),
  log = () => {},
}) {
  const installRoot = path.resolve(root);
  const registered = [];
  const failures = [];
  for (const name of agents) {
    if (name === "codex") continue;
    try {
      if (name === "claude") {
        registerClaude({ root: installRoot, replace, env });
        registered.push({ name });
      } else {
        const skillDirs = installSkills({ root: installRoot, agent: skillAgent(name), home });
        registered.push({ name, skill_dirs: skillDirs });
      }
      log(`Registered PixVerse API Plugin with ${AGENT_LABELS[name]}.`);
    } catch (error) {
      failures.push({ name, message: error.message });
      log(`Could not register PixVerse API Plugin with ${AGENT_LABELS[name]}: ${error.message}`);
    }
  }

  // Remove registrations owned by a previous install that this install did not renew.
  const renewed = new Set(registered.map(({ name }) => name));
  const stale = normalizeReceiptAgents(previous).filter(({ name }) => name !== "codex" && !renewed.has(name) && !agents.includes(name));
  for (const failure of uninstallAgents({ agents: stale, env })) {
    log(`Could not remove the older ${AGENT_LABELS[failure.name]} registration: ${failure.message}`);
  }
  return { agents: registered, failures };
}

export function uninstallAgents({ agents, env = process.env }) {
  const failures = [];
  for (const agent of agents) {
    if (agent.name === "codex") continue;
    try {
      if (agent.name === "claude") unregisterClaude({ env });
      else removeSkills(agent.skill_dirs ?? []);
    } catch (error) {
      failures.push({ name: agent.name, message: error.message });
    }
  }
  return failures;
}

// Legacy receipts predate multi-agent support and always registered Codex only.
export function normalizeReceiptAgents(receipt) {
  if (!receipt) return [];
  if (!Array.isArray(receipt.agents)) return [{ name: "codex" }];
  return receipt.agents
    .filter((agent) => agent && AGENT_NAMES.includes(agent.name))
    .map((agent) => ({
      name: agent.name,
      ...(Array.isArray(agent.skill_dirs) ? { skill_dirs: agent.skill_dirs.filter((dir) => typeof dir === "string") } : {}),
    }));
}

function skillAgent(name) {
  const agent = SKILL_AGENTS.find((candidate) => candidate.name === name);
  if (!agent) throw new Error(`Unsupported agent: ${name}`);
  return agent;
}

function installSkills({ root, agent, home }) {
  const sourceRoot = path.join(root, "agent-skills");
  const targetRoot = path.join(home, agent.skillsDir);
  const targets = STANDALONE_SKILLS.map((name) => path.join(targetRoot, name));

  // Refuse before copying anything if a same-named skill belongs to someone else.
  for (const target of targets) {
    if (fs.existsSync(target) && !isOwnedSkillDirectory(target)) {
      throw new Error(`${target} already exists and was not installed by PixVerse API Plugin.`);
    }
  }
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const name of STANDALONE_SKILLS) {
    const source = path.join(sourceRoot, name);
    const target = path.join(targetRoot, name);
    const temporary = fs.mkdtempSync(path.join(targetRoot, `.${name}-`));
    try {
      fs.cpSync(source, temporary, { recursive: true, errorOnExist: false, force: true, verbatimSymlinks: true });
      fs.rmSync(target, { recursive: true, force: true });
      fs.renameSync(temporary, target);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  return targets;
}

function removeSkills(skillDirs) {
  for (const directory of skillDirs) {
    const resolved = path.resolve(directory);
    if (!STANDALONE_SKILLS.includes(path.basename(resolved))) {
      throw new Error(`Refusing to remove an unexpected skill path: ${resolved}`);
    }
    if (!fs.existsSync(resolved)) continue;
    if (!isOwnedSkillDirectory(resolved)) {
      throw new Error(`Refusing to remove ${resolved} because it was not installed by PixVerse API Plugin.`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function isOwnedSkillDirectory(directory) {
  try {
    const stats = fs.lstatSync(directory);
    return stats.isDirectory() && fs.lstatSync(path.join(directory, OWNER_MARKER)).isFile();
  } catch {
    return false;
  }
}

function registerClaude({ root, replace, env }) {
  const claude = findCommand("claude", env);
  if (!claude) throw new Error("the `claude` command was not found.");

  const existing = listClaudeMarketplaces(claude, env).find(({ name }) => name === MARKETPLACE_NAME);
  if (existing && (replace || path.resolve(existing.path ?? "") !== root)) {
    unregisterClaude({ env });
  }
  const addedMarketplace = !existing || replace || path.resolve(existing.path ?? "") !== root;

  try {
    runClaude(claude, ["plugin", "marketplace", "add", root], env);
    if (!addedMarketplace) runClaude(claude, ["plugin", "marketplace", "update", MARKETPLACE_NAME], env);
    const result = parseJsonLine(runClaude(claude, ["plugin", "install", CLAUDE_PLUGIN_ID, "--json"], env));
    if (result?.installedVersion && result?.availableVersion && result.installedVersion !== result.availableVersion) {
      runClaude(claude, ["plugin", "update", CLAUDE_PLUGIN_ID], env);
    }
  } catch (error) {
    if (addedMarketplace) {
      runClaude(claude, ["plugin", "marketplace", "remove", MARKETPLACE_NAME], env, { allowFailure: true });
    }
    throw error;
  }
}

function unregisterClaude({ env }) {
  const claude = findCommand("claude", env);
  if (!claude) throw new Error("the `claude` command was not found, so the Claude Code registration was kept.");
  runClaude(claude, ["plugin", "uninstall", CLAUDE_PLUGIN_ID, "--json"], env, { absentPattern: /not_installed|not found in installed plugins/ });
  runClaude(claude, ["plugin", "marketplace", "remove", MARKETPLACE_NAME], env, { absentPattern: /not found/i });
}

function listClaudeMarketplaces(claude, env) {
  const output = runClaude(claude, ["plugin", "marketplace", "list", "--json"], env);
  try {
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function runClaude(claude, args, env, { allowFailure = false, absentPattern } = {}) {
  const result = spawnSync(claude, args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status === 0 || allowFailure) return result.stdout ?? "";
  if (absentPattern?.test(output)) return result.stdout ?? "";
  const detail = output.trim().split("\n").filter(Boolean).at(-1) ?? `exit status ${result.status}`;
  throw new Error(`claude ${args.slice(0, 3).join(" ")} failed: ${detail}`);
}

function parseJsonLine(output) {
  for (const line of output.trim().split("\n").reverse()) {
    try {
      return JSON.parse(line);
    } catch {
      // Not JSON; keep looking.
    }
  }
  return null;
}

function readReceipt(receiptPath) {
  if (!receiptPath || !fs.existsSync(receiptPath)) return null;
  return JSON.parse(fs.readFileSync(receiptPath, "utf8"));
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument: ${flag}`);
    const key = flag.slice(2);
    if (key === "replace") options.replace = true;
    else options[key] = rest[++index];
  }
  return { command, options };
}

function main(argv) {
  const { command, options } = parseArguments(argv);
  const log = (message) => process.stderr.write(`${message}\n`);
  if (command === "select") {
    process.stdout.write(selectAgents({ requested: process.env.PIXVERSE_API_AGENTS }).join("\n"));
    return 0;
  }
  if (command === "install") {
    const result = installAgents({
      root: options.root,
      agents: (options.agents ?? "").split(",").filter(Boolean),
      previous: readReceipt(options["previous-receipt"]),
      replace: options.replace === true,
      log,
    });
    fs.writeFileSync(options.result, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    return 0;
  }
  if (command === "uninstall") {
    const failures = uninstallAgents({ agents: normalizeReceiptAgents(readReceipt(options.receipt)) });
    for (const failure of failures) log(`Could not remove the ${AGENT_LABELS[failure.name]} registration: ${failure.message}`);
    return failures.length === 0 ? 0 : 1;
  }
  throw new Error("Usage: agents.js select | install --root <dir> --agents <list> --result <file> | uninstall --receipt <file>");
}

function isExecutedDirectly() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
