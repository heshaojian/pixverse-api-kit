import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const brandRoot = path.join(pitchRoot, "assets/brand");
const manifestPath = path.join(brandRoot, "brand-assets.json");

test("VIPS co-brand assets retain verified local provenance", async () => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  assert.equal(manifest.schemaVersion, "vips-brand-assets.v1");
  assert.deepEqual(manifest.assets.map(({ id }) => id), [
    "vips-site-icon",
    "pixverse-touch-icon",
  ]);
  assert.equal(manifest.assets[0].sourceUrl, "https://www.vip.com/favicon.ico");
  assert.equal(
    manifest.assets[0].sha256,
    "bb13d3b13ead92bd6c7ba6f654ec9016710a5c92c6e7ca2942c3207e3d9d9539",
  );
  assert.equal(manifest.assets[0].width, 16);
  assert.equal(manifest.assets[0].height, 16);
  assert.equal(manifest.assets[1].width, 180);
  assert.equal(manifest.assets[1].height, 180);

  for (const asset of manifest.assets) {
    assert.match(asset.path, /^assets\/brand\/[a-z0-9.-]+$/);
    const absolutePath = path.resolve(pitchRoot, asset.path);
    assert.ok(absolutePath.startsWith(`${brandRoot}${path.sep}`));
    const [bytes, mimeResult] = await Promise.all([
      fs.readFile(absolutePath),
      execFile("file", ["--brief", "--mime-type", absolutePath], { encoding: "utf8" }),
    ]);
    assert.equal(bytes.length, asset.bytes, asset.id);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.id);
    assert.equal(mimeResult.stdout.trim(), asset.mimeType, asset.id);
  }
});
