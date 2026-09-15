import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const comparisonRoot = new URL("../qa/revolve-v3-v4-comparison/", import.meta.url);
const manifestPath = new URL("comparison-manifest.json", comparisonRoot);
const pagePath = new URL("index.html", comparisonRoot);
const controllerPath = new URL("app.js", comparisonRoot);

const readText = (url) => fs.readFile(url, "utf8");
const readJson = async (url) => JSON.parse(await readText(url));

test("comparison manifest maps ten unique products to local V3 and V4 assets", async () => {
  const manifest = await readJson(manifestPath);

  assert.equal(manifest.products.length, 10);
  assert.equal(new Set(manifest.products.map(({ productId }) => productId)).size, 10);

  for (const product of manifest.products) {
    assert.equal(product.v3.model, "Seedance 2.5");
    assert.equal(product.v3.resolution, "720 x 1280");
    assert.equal(product.v4.model, "MiniMax H3");
    assert.equal(product.v4.resolution, "1440 x 2560");
    assert.match(product.v3.video, /^\/pixverse-cli-jobs\/revolve-v3\//);
    assert.match(product.v4.video, /^\/pixverse-cli-jobs\/revolve-v4\//);
    assert.ok(product.references.length >= 3);

    for (const assetPath of [product.v3.video, product.v4.video, ...product.references]) {
      assert.doesNotMatch(assetPath, /\/Users\/|https?:\/\//);
    }

    for (const referencePath of product.references) {
      await fs.access(path.join(workspaceRoot, referencePath));
    }

    for (const videoPath of [product.v3.video, product.v4.video]) {
      assert.match(videoPath, /^\/pixverse-cli-jobs\/revolve-v[34]\/[^/]+\/video(?:-[a-z0-9]+)?(?:-with-music)?\.mp4$/);
    }
  }
});

test("comparison page exposes equal stages and shared evaluation controls", async () => {
  const html = await readText(pagePath);

  assert.match(html, /id="v3-video"/);
  assert.match(html, /id="v4-video"/);
  assert.match(html, /class="version-stage"/);
  assert.match(html, /id="play-toggle"/);
  assert.match(html, /id="restart"/);
  assert.match(html, /id="timeline"/);
  assert.match(html, /name="audio-mode"/);
  assert.match(html, /id="product-list"/);
  assert.match(html, /id="reference-strip"/);
  assert.doesNotMatch(html, /\bautoplay\b/);
});

test("comparison controller synchronizes normalized playback and restores URL state", async () => {
  const controller = await readText(controllerPath);

  assert.match(controller, /MAX_SYNC_DRIFT_SECONDS\s*=\s*0\.1/);
  assert.match(controller, /requestAnimationFrame/);
  assert.match(controller, /normalizedPosition/);
  assert.match(controller, /audio-mode/);
  assert.match(controller, /window\.location\.hash/);
  assert.match(controller, /hashchange/);
  assert.match(controller, /loadedmetadata/);
  assert.match(controller, /media-error/);
  assert.match(controller, /playbackRate\s*=\s*v4Duration\s*\/\s*v3Duration/);
  assert.match(controller, /video\.currentSrc\s*!==/);
  assert.match(controller, /loadGeneration/);
  assert.match(controller, /AbortController/);
});

test("comparison viewer follows the approved product and mobile presentation", async () => {
  const [html, controller, styles] = await Promise.all([
    readText(pagePath),
    readText(controllerPath),
    readText(new URL("styles.css", comparisonRoot)),
  ]);

  assert.match(html, /revolve-wordmark\.png/);
  assert.match(html, /pixverse-logo\.svg/);
  assert.match(controller, /product\.productId/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.stage-grid\s*{[^}]*grid-template-columns:\s*1fr/);
});

test("comparison assets contain no secrets or absolute personal paths", async () => {
  const contents = await Promise.all([
    readText(manifestPath),
    readText(pagePath),
    readText(controllerPath),
    readText(new URL("styles.css", comparisonRoot)),
  ]);
  const release = contents.join("\n");

  assert.doesNotMatch(release, /mh_live_|PIXVERSE_API_KEY|Authorization:\s*Bearer|\/Users\/john|127\.0\.0\.1|localhost/i);
});
