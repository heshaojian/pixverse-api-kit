import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

const reviewRoot = new URL("../deploy/brand-pitches/revolve/pdp-review/", import.meta.url);
const v4Page = new URL("../deploy/brand-pitches/revolve/v4/index.html", import.meta.url);
const campaignRoot = new URL("../pixverse-api-jobs/revolve-pdp/", import.meta.url);
const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("review catalog contains the fourteen Standard/high PDP outputs in campaign order", async () => {
  const [catalog, campaign, batch, comparison] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    readJson(new URL("campaign.json", campaignRoot)),
    readJson(new URL("standard-high-batch-results.json", campaignRoot)),
    readJson(new URL("comparisons/lior-wd140-standard-high/qa.json", campaignRoot)),
  ]);

  assert.equal(catalog.schemaVersion, "revolve-pdp-review.v1");
  assert.equal(catalog.products.length, 14);
  assert.equal(new Set(catalog.products.map(({ id }) => id)).size, 14);
  assert.deepEqual(
    catalog.products.map(({ id }) => id),
    campaign.products.map(({ product_id: productId }) => productId),
  );
  assert.equal(campaign.settings.mode, "standard");
  assert.equal(campaign.settings.quality, "high");

  const expectedVideos = new Map(batch.results.map((result) => [result.product_id, result.video_url]));
  expectedVideos.set("LIOR-WD140", comparison.standard_high.video_url);
  for (const product of catalog.products) {
    assert.equal(product.videoUrl, expectedVideos.get(product.id), product.id);
    assert.match(product.productUrl, /^https:\/\/www\.revolve\.com\//);
    assert.match(product.poster, /^\.\/assets\/posters\/[A-Z0-9-]+\.jpg$/);
    assert.ok(product.motionDescription.trim(), product.id);
  }
});

test("the original 0911 source remains byte-identical", async () => {
  assert.equal(
    sha256(await fs.readFile(v4Page)),
    "f845fcfadeb49776d7ad1e03d57b06f7bf8ff77d16f76175936776a816a1d948",
  );
});

test("review catalog is presentation-only and contains no private operations data", async () => {
  const raw = await fs.readFile(new URL("catalog.json", reviewRoot), "utf8");
  assert.doesNotMatch(raw, /mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:\s*Bearer/i);
  assert.doesNotMatch(raw, /\/Users\/|job_dir|video_id|ledger|price|wallet|prompt|created_at/i);
});
