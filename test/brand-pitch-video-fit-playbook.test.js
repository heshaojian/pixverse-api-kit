import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const playbookUrl = new URL("../docs/brand-pitches/playbook.md", import.meta.url);

test("brand pitch playbook requires consistent contain framing for inline and fullscreen video", async () => {
  const playbook = await fs.readFile(playbookUrl, "utf8");

  assert.match(playbook, /every (?:inline )?video player/i);
  assert.match(playbook, /featured and non-featured/i);
  assert.match(playbook, /object-fit:\s*contain/i);
  assert.match(playbook, /object-position:\s*center/i);
  assert.match(playbook, /:fullscreen/);
  assert.match(playbook, /letterboxing[\s\S]+cropping the product/i);
  assert.match(playbook, /no unapproved `object-fit:\s*cover`/i);
});
