import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const workspaceRoot = new URL("../", import.meta.url);
const pitchPath = new URL("../deploy/brand-pitches/revolve/v4/index.html", import.meta.url);
const releaseReportPath = new URL("../pixverse-cli-jobs/revolve-v4/qa-report.json", import.meta.url);

test("REVOLVE pitch opens with customer proof instead of AI education", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.match(html, /Make every new drop move at REVOLVE speed\./);
  assert.ok(html.indexOf('id="demos"') < html.indexOf('id="pilot"'));
  assert.doesNotMatch(html, /The Opportunity|Pilot Hypothesis|From Product Page To Video Concept|AI-generated billboard/);
  assert.doesNotMatch(html, /\$1\.2B|140K\+|1,600\+|81%|Gen Z/);
});

test("REVOLVE pitch loads one flagship preview and defers the rest", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 13);
});

test("REVOLVE pitch presents 14 unique demos and a measurable pilot", async () => {
  const html = await fs.readFile(pitchPath, "utf8");

  assert.equal((html.match(/class="demo-card/g) ?? []).length, 14);
  assert.equal((html.match(/<video /g) ?? []).length, 14);
  assert.equal(new Set([...html.matchAll(/<video[^>]+src="([^"]+)"/g)].map(([, src]) => src)).size, 14);
  assert.match(html, /Featured Demos<\/h2><span>01–06 \/ 14<\/span>/);
  assert.match(html, /Eight additional products across dresses, tops, pants, and outerwear\./);
  assert.doesNotMatch(html, /Additional REVOLVE Demos/);
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
  const releaseReport = JSON.parse(await fs.readFile(releaseReportPath, "utf8"));
  const expectedUrls = new Set(releaseReport.records.map(({ final_url: finalUrl }) => finalUrl));
  const linkedUrls = new Set(
    [...html.matchAll(/<a class="pixverse-link" href="([^"]+)"/g)].map(([, href]) => href),
  );

  assert.equal(releaseReport.records.length, 14);
  assert.equal(new Set(releaseReport.records.map(({ video_id: videoId }) => videoId)).size, 14);
  assert.ok(releaseReport.records.every(({ final_url: finalUrl }) => finalUrl.startsWith("https://media.pixverse.ai/")));
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

  await fs.access(new URL("deploy/brand-pitches/revolve/v4/assets/revolve-wordmark.png", workspaceRoot));
  await fs.access(new URL("deploy/brand-pitches/revolve/v4/assets/pixverse-logo.svg", workspaceRoot));
});
