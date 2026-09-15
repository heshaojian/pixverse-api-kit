import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCreatePayload } from "../src/client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDirectory = path.join(root, "payloads/plaud-hardware-demos-controlled");
const generationInstructionPattern =
  /create a .*video|video prompt|motion direction|model must|camera|lip-sync|creative brief|talking avatar|captions|subtitles|floating UI/i;

test("controlled Plaud requests separate product facts from creative direction", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(payloadDirectory, "manifest.json"), "utf8"));

  assert.equal(manifest.records.length, 3);

  for (const record of manifest.records) {
    const payload = JSON.parse(await fs.readFile(path.join(root, record.payload), "utf8"));

    validateCreatePayload(payload);
    assert.ok(payload.product.description.length >= 100);
    assert.doesNotMatch(payload.product.description, generationInstructionPattern);
    assert.equal(payload.metadata.product_description_source, payload.product.source_url);
    assert.equal("creative_brief" in payload.metadata, false);
    assert.equal(payload.video.duration_seconds, 15);
    assert.equal(payload.video.resolution, "1080p");
    assert.equal(payload.video.voiceover, false);
    assert.equal(payload.video.captions, false);
    assert.equal(payload.video.avatar.mode, "auto");
    assert.match(payload.video.creative_ad_clone, /Silent hardware product demo/i);
    assert.match(payload.video.creative_ad_clone, /No narration/i);
    assert.match(payload.video.creative_ad_clone, /no .*lip movement/i);
    assert.equal(payload.metadata.generation_path, "growth_studio_agent_kit_controlled_product_facts");
    assert.equal(payload.metadata.supersedes_payload, record.supersedes_payload);
  }
});
