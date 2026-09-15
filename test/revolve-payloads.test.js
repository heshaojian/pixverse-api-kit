import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDirs = [
  "payloads/revolve-pitch-10-demos",
  "payloads/revolve-cmo-silent-10-demos",
];

async function readProductPayloads(directory) {
  const directoryPath = path.join(root, directory);
  const filenames = (await fs.readdir(directoryPath))
    .filter((filename) => filename.endsWith(".json") && filename !== "manifest.json")
    .sort();

  return Promise.all(filenames.map(async (filename) => ({
    filename,
    payload: JSON.parse(await fs.readFile(path.join(directoryPath, filename), "utf8")),
  })));
}

test("all REVOLVE requests use sourced product descriptions", async () => {
  let checked = 0;

  for (const directory of payloadDirs) {
    const payloads = await readProductPayloads(directory);

    for (const { filename, payload } of payloads) {
      checked += 1;
      assert.ok(payload.product.description.length >= 80, `${filename} description is too short`);
      assert.doesNotMatch(
        payload.product.description,
        /create a .*video|video prompt|motion direction|model must|camera|lip-sync|creative brief/i,
        `${filename} still contains generation instructions`,
      );
      assert.equal(payload.metadata.product_description_source, payload.product.source_url);
      assert.equal("creative_brief" in payload.metadata, false, `${filename} still has creative_brief metadata`);
    }
  }

  assert.equal(checked, 21);
});
