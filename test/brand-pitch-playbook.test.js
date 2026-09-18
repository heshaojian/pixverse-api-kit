import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const reusablePlaybook = new URL("../docs/brand-pitches/playbook.md", import.meta.url);
const revolveWorkflow = new URL("../docs/brand-pitches/revolve-video-generation-workflow.md", import.meta.url);

test("brand pitch guidance requires exact-length music generation", async () => {
  const [playbook, workflow] = await Promise.all([
    fs.readFile(reusablePlaybook, "utf8"),
    fs.readFile(revolveWorkflow, "utf8"),
  ]);

  for (const document of [playbook, workflow]) {
    assert.match(document, /--duration-seconds/);
    assert.match(document, /duration_auto=false/);
    assert.match(document, /ffprobe/);
    assert.match(document, /prompt wording[^\n]+does not replace/i);
  }
});

test("brand pitch guidance makes official product photos the color and texture authority", async () => {
  const [playbook, workflow] = await Promise.all([
    fs.readFile(reusablePlaybook, "utf8"),
    fs.readFile(revolveWorkflow, "utf8"),
  ]);

  for (const document of [playbook, workflow]) {
    assert.match(document, /official product (photographs|photos)[^\n]+(?:color|colour)[^\n]+texture/i);
    assert.match(document, /catalog color name[^\n]+not[^\n]+visual/i);
    assert.match(document, /texture-neutral storyboard/i);
    assert.match(document, /official product (photographs|photos) override the storyboard/i);
    assert.match(document, /underexposure/i);
  }
});

test("brand pitch guidance protects logos and lettering with ordered references and character-level QA", async () => {
  const [playbook, workflow] = await Promise.all([
    fs.readFile(reusablePlaybook, "utf8"),
    fs.readFile(revolveWorkflow, "utf8"),
  ]);

  for (const document of [playbook, workflow]) {
    assert.match(document, /official (?:front|product)[^\n]+first/i);
    assert.match(document, /official (?:logo|branding|label)[^\n]+(?:close-up|detail)/i);
    assert.match(document, /storyboard[^\n]+last/i);
    assert.match(document, /character[- ]level/i);
    assert.match(document, /automatic rejection/i);
  }
});

test("brand pitch guidance selects poster frames from product-readable moments", async () => {
  const [playbook, workflow] = await Promise.all([
    fs.readFile(reusablePlaybook, "utf8"),
    fs.readFile(revolveWorkflow, "utf8"),
  ]);

  for (const document of [playbook, workflow]) {
    assert.match(document, /poster frame/i);
    assert.match(document, /first clean product-readability moment/i);
    assert.match(document, /not automatically from `0:00`/i);
    assert.match(document, /material[^\n]+color[^\n]+silhouette[^\n]+logos[^\n]+text/i);
    assert.match(document, /walk-in[^\n]+walk-out[^\n]+motion blur[^\n]+awkward crops[^\n]+empty background/i);
  }
});

test("REVOLVE workflow reflects the complete 14-demo assortment", async () => {
  const workflow = await fs.readFile(revolveWorkflow, "utf8");

  assert.match(workflow, /fourteen videos/i);
  assert.match(workflow, /\| Products \| 14 \|/);
  assert.match(workflow, /original ten-product assortment[^\n]+three customer-requested additions[^\n]+one additional product/i);
});
