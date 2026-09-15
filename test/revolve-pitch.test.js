import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const pitchPath = new URL("../pilot/revolve-growth-studio-5sku/index.html", import.meta.url);
const videoDataPath = new URL("../pilot/revolve-growth-studio-5sku/demo-videos-silent.json", import.meta.url);

test("REVOLVE pitch opens with customer proof instead of AI education", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.match(html, /Make Every New Drop Move At REVOLVE Speed/);
  assert.ok(html.indexOf('id="demos"') < html.indexOf('id="pilot"'));
  assert.doesNotMatch(html, /The Opportunity|Pilot Hypothesis|From Product Page To Video Concept|AI-generated billboard/);
  assert.doesNotMatch(html, /\$1\.2B|140K\+|1,600\+|81%|Gen Z/);
});

test("REVOLVE pitch loads one flagship preview and defers the rest", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 9);
});

test("REVOLVE pitch presents 10 unique demos and a measurable pilot", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.equal((html.match(/class="demo-card/g) ?? []).length, 10);
  assert.equal((html.match(/<video /g) ?? []).length, 10);
  assert.equal(new Set([...html.matchAll(/<video[^>]+src="([^"]+)"/g)].map(([, src]) => src)).size, 10);
  assert.match(html, /A Focused 1-Week REVOLVE Pilot/);
  assert.match(html, /10 Priority Products/);
  assert.match(html, /Fidelity Pass Rate/);
  assert.match(html, /≥90%/);
  assert.match(html, /Turnaround Time/);
  assert.match(html, /≤10 Min/);
  assert.doesNotMatch(html, /2-Week|two-week|≥80%|≤1 Day|Live Channel Test/);
  assert.doesNotMatch(html, /mh_live_/);
});

test("REVOLVE pitch exposes all regenerated PixVerse video links", async () => {
  const html = await fs.readFile(pitchPath, "utf8");
  const videoData = JSON.parse(await fs.readFile(videoDataPath, "utf8"));
  const expectedUrls = new Set(videoData.demos.map(({ video_url: videoUrl }) => videoUrl));
  const linkedUrls = new Set(
    [...html.matchAll(/<a class="pixverse-link" href="([^"]+)"/g)].map(([, href]) => href),
  );

  assert.equal(videoData.demos.length, 10);
  assert.ok(videoData.demos.every(({ status }) => status === "succeeded"));
  assert.equal(new Set(videoData.demos.map(({ video_id: videoId }) => videoId)).size, 10);
  assert.ok(videoData.demos.every(({ video_url: videoUrl }) => videoUrl.startsWith("https://media.pixverse.ai/")));
  assert.deepEqual(linkedUrls, expectedUrls);
});

test("REVOLVE pitch removes internal research and file-delivery labels", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.doesNotMatch(html, /Public Top-Seller Signal|New-Arrival Candidate|adjacency|Price on page|>MP4</);
  assert.match(html, /View Product/);
});

test("REVOLVE pitch anchors remain visible below the mobile header", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.match(html, /<body id="page-top">/);
  assert.match(html, /class="brand" href="#page-top"/);
  assert.match(html, /\.section \{ scroll-margin-top: 150px; \}/);
});

test("REVOLVE pitch uses the real co-brand lockup without redundant hero pills", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.match(html, /src="\.\/assets\/revolve-wordmark\.png"/);
  assert.match(html, /src="\.\/assets\/pixverse-logo\.svg"/);
  assert.doesNotMatch(html, /brand-mark|proof-caption|One-Click Product Video|Original REVOLVE Product|15s · 9:16/);

  await fs.access(new URL("../pilot/revolve-growth-studio-5sku/assets/revolve-wordmark.png", import.meta.url));
  await fs.access(new URL("../pilot/revolve-growth-studio-5sku/assets/pixverse-logo.svg", import.meta.url));
});
