import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const workspaceRoot = new URL("../", import.meta.url);
const v4Root = new URL("../pixverse-cli-jobs/revolve-v4/", import.meta.url);
const pagePath = new URL("../deploy/brand-pitches/revolve/v4/index.html", import.meta.url);

const readJson = async (url) => JSON.parse(await fs.readFile(url, "utf8"));

test("V4 request manifests use MiniMax H3 and V4-local provenance", async () => {
  const batch = await readJson(new URL("batch-config.json", v4Root));

  for (const product of batch.products) {
    const request = await readJson(new URL(`${product.directory}/source-request.json`, v4Root));
    const serialized = JSON.stringify(request);

    assert.equal(request.video.model, "minimax-h3");
    assert.equal(request.video.quality, "1440p");
    assert.equal(request.music.model, "music-3.0");
    assert.match(request.job_dir, /^pixverse-cli-jobs\/revolve-v4\//);
    assert.match(request.video.prompt_file, /^pixverse-cli-jobs\/revolve-v4\//);
    assert.match(request.storyboard.sha256, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(serialized, /\/Users\/john\//);
    assert.doesNotMatch(serialized, /revolve-v[0-3]/);
  }
});

test("V4 customer-facing order matches the batch display order", async () => {
  const html = await fs.readFile(pagePath, "utf8");
  const batch = await readJson(new URL("batch-config.json", v4Root));
  const pageOrder = [...html.matchAll(/href="https:\/\/www\.revolve\.com\/[^\"]+\/dp\/([^/]+)\//g)]
    .map(([, productId]) => productId);
  const displayOrder = [...batch.products]
    .sort((left, right) => left.display_order - right.display_order)
    .map(({ product_id: productId }) => productId);

  assert.deepEqual(pageOrder, displayOrder);
  assert.deepEqual(displayOrder.slice(0, 3), ["LIOR-WD140", "BARD-WS308", "HELO-WD29"]);
});

test("V4 release report traces every published video and soundtrack", async () => {
  const html = await fs.readFile(pagePath, "utf8");
  const report = await readJson(new URL("qa-report.json", v4Root));

  assert.equal(report.records.length, 10);
  assert.equal(new Set(report.records.map(({ video_id: videoId }) => videoId)).size, 10);
  assert.equal(new Set(report.records.map(({ music_id: musicId }) => musicId)).size, 10);
  assert.equal(new Set(report.records.map(({ final_url: finalUrl }) => finalUrl)).size, 10);
  assert.ok(report.records.every(({ final_url: finalUrl }) => html.includes(finalUrl)));
  assert.ok(report.records.every(({ checks }) => Object.values(checks).every(Boolean)));
  assert.ok(Object.values(report.release_gate).every(Boolean));
});

test("V4 videos are controlled, audible, and described accessibly", async () => {
  const html = await fs.readFile(pagePath, "utf8");

  assert.equal((html.match(/<video\b/g) ?? []).length, 10);
  assert.equal((html.match(/aria-describedby="motion-/g) ?? []).length, 10);
  assert.equal((html.match(/class="sr-only" id="motion-/g) ?? []).length, 10);
  assert.doesNotMatch(html, /\bautoplay\b|\bmuted\b/);
  assert.doesNotMatch(html, /mh_live_|PIXVERSE_API_KEY|Authorization:\s*Bearer|127\.0\.0\.1|localhost/i);

  await fs.access(new URL("deploy/brand-pitches/revolve/v4/assets/posters/LIOR-WD140.jpg", workspaceRoot));
});

test("V4 featured videos fit complete portrait frames across viewports", async () => {
  const html = await fs.readFile(pagePath, "utf8");

  assert.match(html, /--featured-card-width/);
  assert.match(html, /100svh\s*-\s*128px/);
  assert.match(html, /@media \(min-width: 1101px\)/);
  assert.match(html, /@media \(min-width: 821px\) and \(max-width: 1100px\)/);
  assert.match(html, /@media \(max-width: 820px\)[\s\S]*--featured-card-width:\s*min\(100%,\s*calc\(56\.25svh\s*-\s*70px\),\s*607px\)/);
  assert.match(html, /@media \(max-width: 520px\)[\s\S]*\.pixverse-lockup > span\s*{\s*display:\s*none/);
  assert.match(html, /\.featured-grid \.demo-media video\s*{[^}]*object-fit:\s*contain/);
});

test("V4 uses the PixVerse logo as its page icon", async () => {
  const html = await fs.readFile(pagePath, "utf8");

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/assets\/pixverse-logo\.svg">/);
  await fs.access(new URL("deploy/brand-pitches/revolve/v4/assets/pixverse-logo.svg", workspaceRoot));
});

test("V4 pitch copy is current and has a complete sharing preview", async () => {
  const html = await fs.readFile(pagePath, "utf8");

  assert.match(html, /Make every new drop move at REVOLVE speed\./);
  assert.doesNotMatch(html, /class="demo-detail">[^<]*\$/);
  assert.match(html, /<meta property="og:title" content="REVOLVE × PixVerse \| Product Video Demos">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/revolve-pixverse-0911\.pages\.dev\/assets\/revolve-pixverse-share\.jpg">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:image:alt" content="REVOLVE and PixVerse product video pilot featuring three fashion demos">/);

  await fs.access(new URL("deploy/brand-pitches/revolve/v4/assets/revolve-pixverse-share.jpg", workspaceRoot));
});

test("V4 eagerly loads only visible posters and defers the rest", async () => {
  const html = await fs.readFile(pagePath, "utf8");

  const posterPaths = [...html.matchAll(/data-poster="(\.\/assets\/posters\/[^"]+)"/g)].map(([, path]) => path);
  assert.equal(posterPaths.length, 10);
  assert.equal((html.match(/\sposter="\.\/assets\/posters\//g) ?? []).length, 1);
  assert.match(html, /matchMedia\("\(min-width: 821px\)"\)\.matches \? 3 : 1/);
  assert.match(html, /new IntersectionObserver/);
  assert.match(html, /const posterPreloadMargin = window\.matchMedia\("\(min-width: 821px\)"\)\.matches \? "500px 0px" : "200px 0px"/);
  assert.match(html, /rootMargin:\s*posterPreloadMargin/);
  assert.match(html, /if \(!\("IntersectionObserver" in window\)\)/);

  await Promise.all(posterPaths.map((path) => fs.access(new URL(`deploy/brand-pitches/revolve/v4/${path.slice(2)}`, workspaceRoot))));
});
