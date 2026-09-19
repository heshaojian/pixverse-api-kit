import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PLATFORM_OPERATIONS } from "../src/platform/operations.js";

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
