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

test("review page is isolated, no-index, and renders fourteen product proofs", async () => {
  const [catalog, html, css, app, headers, robots] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    fs.readFile(new URL("index.html", reviewRoot), "utf8"),
    fs.readFile(new URL("styles.css", reviewRoot), "utf8"),
    fs.readFile(new URL("app.js", reviewRoot), "utf8"),
    fs.readFile(new URL("_headers", reviewRoot), "utf8"),
    fs.readFile(new URL("robots.txt", reviewRoot), "utf8"),
  ]);

  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(html, /<title>REVOLVE × PixVerse \| PDP Video Review<\/title>/);
  assert.equal((html.match(/<video\b/g) ?? []).length, 14);
  assert.equal((html.match(/aria-describedby="motion-/g) ?? []).length, 14);
  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 13);
  assert.ok(catalog.products.every(({ videoUrl, productUrl }) =>
    html.includes(videoUrl) && html.includes(productUrl)
  ));
  assert.match(html, />Internal Review</);
  assert.doesNotMatch(html, /Pilot|Schedule|mailto:|revolve-pdp\.pages\.dev/);
  assert.match(css, /\.demo-media video[^}]*object-fit:\s*contain/s);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(app, /IntersectionObserver/);
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow, noarchive/i);
  assert.match(robots, /Disallow:\s*\//);
});

test("deployable review files expose no credentials or internal artifacts", async () => {
  const names = ["index.html", "styles.css", "app.js", "catalog.json", "_headers", "robots.txt"];
  const raw = (await Promise.all(names.map((name) =>
    fs.readFile(new URL(name, reviewRoot), "utf8")
  ))).join("\n");
  assert.doesNotMatch(raw, /mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:\s*Bearer|\/Users\//i);
  assert.doesNotMatch(raw, /job_dir|video_id|ledger_source|wallet|generation-command/i);
});

test("every product has a nonempty local poster", async () => {
  const catalog = await readJson(new URL("catalog.json", reviewRoot));
  for (const product of catalog.products) {
    const poster = new URL(product.poster.replace(/^\.\//, ""), reviewRoot);
    const stat = await fs.stat(poster);
    assert.ok(stat.isFile(), product.id);
    assert.ok(stat.size > 10_000, `${product.id} poster is unexpectedly small`);
  }
});

test("each Standard/high video appears once as a player and once as a direct link", async () => {
  const [catalog, html] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    fs.readFile(new URL("index.html", reviewRoot), "utf8"),
  ]);
  assert.equal(new Set(catalog.products.map(({ videoUrl }) => videoUrl)).size, 14);
  for (const { id, videoUrl } of catalog.products) {
    const escaped = videoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(videoUrl, /^https:\/\/media\.pixverse\.ai\//);
    assert.equal((html.match(new RegExp(escaped, "g")) ?? []).length, 2, id);
  }
});
