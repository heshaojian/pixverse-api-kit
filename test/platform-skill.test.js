import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PLATFORM_OPERATIONS } from "../src/platform/operations.js";
import { normalizeAndValidatePlatformInput } from "../src/platform/validation.js";

const ROOT = process.cwd();
const SKILL_ROOT = path.join(ROOT, ".agents/skills/pixverse-platform-api");
const REFERENCES = [
  "capabilities.md",
  "operation-catalog.md",
  "payload-examples.json",
];

async function readSkill(relativePath) {
  return fs.readFile(path.join(SKILL_ROOT, relativePath), "utf8");
}

function localMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)]
    .map((match) => match[1]);
}

function parseCatalog(markdown) {
  const rows = markdown.split("\n")
    .filter((line) => /^\| operation:/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", "")));
  return new Map(rows.map((row) => [row[0].replace("operation:", ""), {
    command: row[1], method: row[2], path: row[3], billing: row[4],
    asynchronous: row[5], resultIdPath: row[6], prerequisite: row[7], documentationUrl: row[8],
  }]));
}

function visitIdentifiers(value, key = "") {
  if (Array.isArray(value)) return value.flatMap((item) => visitIdentifiers(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, child]) => visitIdentifiers(child, childKey));
  }
  return /(^|_)(id|ids)$/.test(key) ? [{ key, value }] : [];
}

test("Platform skill exposes the complete progressively disclosed resource graph", async () => {
  const skill = await readSkill("SKILL.md");
  const ui = await readSkill("agents/openai.yaml");

  assert.match(skill, /name: pixverse-platform-api/);
  assert.match(skill, /pixverse-api platform/);
  assert.match(skill, /not.*web.*pixverse|separate.*web.*pixverse/i);
  assert.match(skill, /not.*growth.?studio|separate.*growth.?studio/i);
  assert.match(ui, /display_name: "PixVerse Platform API"/);
  assert.match(ui, /allow_implicit_invocation: true/);
  assert.match(ui, /\$pixverse-platform-api/);

  for (const reference of REFERENCES) {
    assert.match(skill, new RegExp(`references/${reference.replace(".", "\\.")}`));
  }
  for (const operation of PLATFORM_OPERATIONS) {
    assert.match(skill, new RegExp(`operation:${operation.id.replaceAll(".", "\\.")}`));
  }
});

test("all local Markdown links in the skill resolve inside the skill folder", async () => {
  const markdownFiles = ["SKILL.md", "references/capabilities.md"];
  for (const relativeFile of markdownFiles) {
    const markdown = await readSkill(relativeFile);
    for (const target of localMarkdownLinks(markdown)) {
      const resolved = path.resolve(SKILL_ROOT, path.dirname(relativeFile), target);
      assert.equal(resolved.startsWith(`${SKILL_ROOT}${path.sep}`), true);
      await fs.access(resolved);
    }
  }
});

test("operation reference is traceable to every executable catalog row", async () => {
  const catalog = parseCatalog(await readSkill("references/operation-catalog.md"));
  assert.equal(catalog.size, PLATFORM_OPERATIONS.length);
  for (const operation of PLATFORM_OPERATIONS) {
    const row = catalog.get(operation.id);
    assert.ok(row, `missing ${operation.id}`);
    assert.equal(row.command, `platform ${operation.command.join(" ")}`);
    assert.equal(row.method, operation.method);
    assert.equal(row.path, operation.path);
    assert.equal(row.billing, operation.billing);
    assert.equal(row.asynchronous, operation.asynchronous ? "yes" : "no");
    assert.equal(row.resultIdPath, operation.resultIdPath ?? "none");
    assert.notEqual(row.prerequisite, "");
    assert.equal(row.documentationUrl, operation.documentationUrl);
    assert.equal(new URL(row.documentationUrl).hostname, "docs.platform.pixverse.ai");
  }
});

test("every Platform operation has a safe locally valid recipe", async () => {
  const examples = JSON.parse(await readSkill("references/payload-examples.json"));
  assert.deepEqual(Object.keys(examples).sort(), PLATFORM_OPERATIONS.map(({ id }) => id).sort());

  for (const operation of PLATFORM_OPERATIONS) {
    const recipe = examples[operation.id];
    assert.equal(typeof recipe.description, "string");
    assert.ok(recipe.description.length > 0);
    const variants = [{ label: "primary", input: recipe.input }, ...(recipe.alternatives ?? [])];
    for (const variant of variants) {
      await normalizeAndValidatePlatformInput(operation, variant.input, {
        inspectLocalMedia: async () => assert.fail("examples must not require private local media"),
      });
      for (const identifier of visitIdentifiers(variant.input)) {
        if (Array.isArray(identifier.value)) {
          assert.equal(identifier.value.every((item) => typeof item === "string"), true);
        } else {
          assert.equal(typeof identifier.value, "string", `${operation.id}.${identifier.key}`);
        }
      }
    }
  }
});

test("payload recipes contain no credentials, private hosts, or production media URLs", async () => {
  const text = await readSkill("references/payload-examples.json");
  assert.doesNotMatch(text, /PIXVERSE_.*KEY|API-KEY|Bearer\s|api[_-]?key/i);
  for (const match of text.matchAll(/https?:\/\/[^"\\]+/g)) {
    assert.equal(new URL(match[0]).hostname.endsWith("example.test"), true);
  }
});
