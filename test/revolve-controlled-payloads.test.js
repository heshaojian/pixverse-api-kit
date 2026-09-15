import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCreatePayload } from "../src/client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDirectory = path.join(root, "payloads/revolve-cmo-controlled-10-demos");

test("controlled REVOLVE requests separate product facts from creative direction", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(payloadDirectory, "manifest.json"), "utf8"));

  assert.equal(manifest.records.length, 10);

  for (const record of manifest.records) {
    const payload = JSON.parse(await fs.readFile(path.join(root, record.payload), "utf8"));

    validateCreatePayload(payload);
    assert.doesNotMatch(
      payload.product.description,
      /create a .*video|video prompt|motion direction|model must|camera|lip-sync|creative brief/i,
    );
    assert.ok(payload.product.images.length >= 3 && payload.product.images.length <= 4);
    assert.ok(payload.product.images.every(({ url }) => url.startsWith("https://media.pixverse.ai/")));
    assert.equal(payload.video.duration_seconds, 15);
    assert.equal(payload.video.resolution, "1080p");
    assert.equal(payload.video.voiceover, false);
    assert.equal(payload.video.captions, false);
    assert.equal(payload.video.avatar.mode, "custom");
    assert.ok(payload.video.avatar.url.startsWith("https://media.pixverse.ai/"));
    assert.match(payload.video.creative_ad_clone, /silent fashion lookbook/i);
    assert.match(payload.video.creative_ad_clone, /closed-mouth/i);
    assert.match(payload.video.creative_ad_clone, /never speaks/i);
  }
});
