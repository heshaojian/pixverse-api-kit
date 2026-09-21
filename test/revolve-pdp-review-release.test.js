import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import { validateComparisonCatalog } from "../deploy/brand-pitches/revolve/pdp-review/data-model.js";
import { renderComparisonRows } from "../deploy/brand-pitches/revolve/pdp-review/render.js";

const reviewRoot = new URL("../deploy/brand-pitches/revolve/pdp-review/", import.meta.url);
const v4Page = new URL("../deploy/brand-pitches/revolve/v4/index.html", import.meta.url);
const campaignRoot = new URL("../pixverse-api-jobs/revolve-pdp/", import.meta.url);
const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("review catalog contains matched 0911 and Standard/high outputs in campaign order", async () => {
  const [catalog, campaign, batch, comparison, v4Html] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    readJson(new URL("campaign.json", campaignRoot)),
    readJson(new URL("standard-high-batch-results.json", campaignRoot)),
    readJson(new URL("comparisons/lior-wd140-standard-high/qa.json", campaignRoot)),
    fs.readFile(v4Page, "utf8"),
  ]);

  assert.equal(catalog.schemaVersion, "revolve-pdp-review.v2");
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
  const originalUrls = [...v4Html.matchAll(/<video src="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(originalUrls.length, 14);
  assert.deepEqual(
    catalog.products.map(({ sources }) => sources.original0911.videoUrl),
    originalUrls,
  );
  for (const product of catalog.products) {
    assert.equal(product.sources.pdpStandardHigh.videoUrl, expectedVideos.get(product.id), product.id);
    assert.equal(product.sources.original0911.label, "A — 0911 Original");
    assert.equal(product.sources.pdpStandardHigh.label, "B — PDP Standard/high");
    assert.match(product.productUrl, /^https:\/\/www\.revolve\.com\//);
    assert.match(product.sources.original0911.poster, /^\.\/assets\/posters\/0911\/[A-Z0-9-]+\.jpg$/);
    assert.match(product.sources.pdpStandardHigh.poster, /^\.\/assets\/posters\/[A-Z0-9-]+\.jpg$/);
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

test("review page is isolated, no-index, and renders fourteen matched comparisons", async () => {
  const [catalog, html, css, app, headers, robots] = await Promise.all([
    readJson(new URL("catalog.json", reviewRoot)),
    fs.readFile(new URL("index.html", reviewRoot), "utf8"),
    fs.readFile(new URL("styles.css", reviewRoot), "utf8"),
    fs.readFile(new URL("app.js", reviewRoot), "utf8"),
    fs.readFile(new URL("_headers", reviewRoot), "utf8"),
    fs.readFile(new URL("robots.txt", reviewRoot), "utf8"),
  ]);
  const rendered = renderComparisonRows(validateComparisonCatalog(catalog));

  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(html, /<title>REVOLVE × PixVerse \| 0911 vs PDP Review<\/title>/);
  assert.match(html, /id="review-progress" aria-live="polite"/);
  assert.match(html, /id="product-jump"/);
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
  assert.equal((rendered.match(/class="comparison-row"/g) ?? []).length, 14);
  assert.equal((rendered.match(/<video\b/g) ?? []).length, 28);
  assert.equal((rendered.match(/<fieldset class="review-group"/g) ?? []).length, 14);
  assert.equal((rendered.match(/name="review-[^"]+"/g) ?? []).length, 56);
  assert.equal((rendered.match(/aria-describedby="motion-/g) ?? []).length, 28);
  assert.equal((rendered.match(/preload="none"/g) ?? []).length, 28);
  assert.ok(catalog.products.every(({ sources, productUrl }) =>
    rendered.includes(sources.original0911.videoUrl)
      && rendered.includes(sources.pdpStandardHigh.videoUrl)
      && rendered.includes(productUrl)
  ));
  assert.match(html, />Internal Review</);
  assert.doesNotMatch(html, /Pilot|Schedule|mailto:|revolve-pdp\.pages\.dev/);
  assert.match(css, /\.media-frame video[^}]*object-fit:\s*contain/s);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.doesNotMatch(css, /box-shadow/);
  assert.match(app, /IntersectionObserver/);
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow, noarchive/i);
  assert.match(robots, /Disallow:\s*\//);
});

test("deployable review files expose no credentials or internal artifacts", async () => {
  const names = [
    "index.html",
    "styles.css",
    "app.js",
    "catalog.json",
    "data-model.js",
    "pair-controller.js",
    "render.js",
    "review-store.js",
    "_headers",
    "robots.txt",
  ];
  const raw = (await Promise.all(names.map((name) =>
    fs.readFile(new URL(name, reviewRoot), "utf8")
  ))).join("\n");
  assert.doesNotMatch(raw, /mh_live_|PIXVERSE_GROWTH_API_KEY|Authorization:\s*Bearer|\/Users\//i);
  assert.doesNotMatch(raw, /job_dir|video_id|ledger_source|wallet|generation-command/i);
});

test("every source has a nonempty local poster and 0911 posters match V4", async () => {
  const catalog = await readJson(new URL("catalog.json", reviewRoot));
  for (const product of catalog.products) {
    for (const [sourceKey, source] of Object.entries(product.sources)) {
      const poster = new URL(source.poster.replace(/^\.\//, ""), reviewRoot);
      const stat = await fs.stat(poster);
      assert.ok(stat.isFile(), `${product.id} ${sourceKey}`);
      assert.ok(stat.size > 10_000, `${product.id} ${sourceKey} poster is unexpectedly small`);
    }
    const originalPoster = new URL(product.sources.original0911.poster.replace(/^\.\//, ""), reviewRoot);
    const v4Poster = new URL(`assets/posters/${product.id}.jpg`, v4Page);
    assert.equal(
      sha256(await fs.readFile(originalPoster)),
      sha256(await fs.readFile(v4Poster)),
      `${product.id} 0911 poster drifted from V4`,
    );
  }
});

test("each matched video appears once as a player and once as a direct link", async () => {
  const catalog = await readJson(new URL("catalog.json", reviewRoot));
  const rendered = renderComparisonRows(validateComparisonCatalog(catalog));
  const allVideos = catalog.products.flatMap(({ sources }) => Object.values(sources).map(({ videoUrl }) => videoUrl));
  assert.equal(new Set(allVideos).size, 28);
  for (const { id, sources } of catalog.products) {
    for (const { videoUrl } of Object.values(sources)) {
      const escaped = videoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(videoUrl, /^https:\/\/media\.pixverse\.ai\//);
      assert.equal((rendered.match(new RegExp(escaped, "g")) ?? []).length, 2, id);
    }
  }
});
