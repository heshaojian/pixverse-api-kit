import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve("packaging/customer-plugin");
const PLUGIN_ROOT = path.join(SOURCE_ROOT, "plugin");

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(SOURCE_ROOT, relativePath), "utf8"));
}

async function collectTextFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files.sort();
}

test("customer plugin manifests use the approved identity and policy", async () => {
  const marketplace = await readJson("marketplace.json");
  const plugin = await readJson("plugin/.codex-plugin/plugin.json");

  assert.equal(marketplace.name, "pixverse-private-beta");
  assert.equal(marketplace.interface.displayName, "PixVerse Private Beta");
  assert.equal(marketplace.plugins.length, 1);
  assert.deepEqual(marketplace.plugins[0], {
    name: "pixverse-api",
    source: { source: "local", path: "./plugins/pixverse-api" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  });

  assert.equal(plugin.name, "pixverse-api");
  assert.equal(plugin.version, "0.3.0-beta.2");
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.author.name, "PixVerse");
  assert.equal(plugin.interface.displayName, "PixVerse API Plugin");
  assert.equal("mcpServers" in plugin, false);
  assert.equal("apps" in plugin, false);
  assert.equal("hooks" in plugin, false);
});

test("customer plugin exports three neutral wrapper-based skills", async () => {
  const skillDirectory = path.join(PLUGIN_ROOT, "skills");
  const skillNames = (await fs.readdir(skillDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skillNames, ["growth-studio", "platform", "start"]);

  const textFiles = await collectTextFiles(SOURCE_ROOT);
  const allText = (await Promise.all(textFiles.map((file) => fs.readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(allText, /\/Users\/|docs\/superpowers|brand-pitches|revolve|feishu\.cn/i);
  assert.doesNotMatch(allText, /npm run cli|pixverse-api-kit/);
  assert.match(allText, /scripts\/pixverse-api/);
  assert.match(allText, /PIXVERSE_PLATFORM_API_KEY/);
  assert.match(allText, /PIXVERSE_GROWTH_API_KEY/);

  for (const skillName of skillNames) {
    const skillText = await fs.readFile(path.join(skillDirectory, skillName, "SKILL.md"), "utf8");
    assert.match(skillText, new RegExp(`^---\\nname: ${skillName}\\n`, "m"));
    assert.match(skillText, /<plugin-root>\/scripts\/pixverse-api/);
  }
});

test("customer plugin includes the complete private-demo documentation set", async () => {
  const requiredFiles = [
    "INSTALL-MACOS.md",
    "plugin/LICENSE",
    "plugin/NOTICE",
    "plugin/README.md",
    "plugin/SECURITY.md",
    "plugin/SUPPORT.md",
    "plugin/examples/pdp-standard-high.json",
  ];
  for (const relativePath of requiredFiles) {
    const stats = await fs.stat(path.join(SOURCE_ROOT, relativePath));
    assert.equal(stats.isFile(), true, relativePath);
  }

  const license = await fs.readFile(path.join(PLUGIN_ROOT, "LICENSE"), "utf8");
  assert.match(license, /Draft; Not Approved for External Distribution/);
  const notice = await fs.readFile(path.join(PLUGIN_ROOT, "NOTICE"), "utf8");
  assert.match(notice, /json-bigint 1\.0\.0/);
});
