import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  renderCase,
  renderLedger,
  safeUrl,
} from "../../deploy/brand-pitches/vips/human-reviewed-ecommerce/render.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = path.join(
  repoRoot,
  "deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json",
);

const readFixture = async () => JSON.parse(await fs.readFile(fixturePath, "utf8"));

test("renderCase escapes untrusted prompt text", async () => {
  const fixture = await readFixture();
  const record = structuredClone(fixture.chapters[0].cases[0]);
  record.attempts[0].prompt = "<script>alert('x')</script>";

  const html = renderCase(record);

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
});

test("renderCase keeps review evidence inside native independent disclosures", async () => {
  const fixture = await readFixture();
  const html = renderCase(fixture.chapters[0].cases[0]);

  assert.match(html, /<details class="case-record"/);
  assert.match(html, /<details class="review-detail"/);
  assert.match(html, /评审详情/);
  assert.doesNotMatch(html, /name="accordion"/);
});

test("rendered external links are HTTPS and noreferrer", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);

  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
    assert.match(tag, /href="https:\/\//);
    assert.match(tag, /rel="noreferrer"/);
  }
});

test("rendered media uses accessible lazy local evidence", async () => {
  const fixture = await readFixture();
  const localCase = fixture.chapters.flatMap(({ cases }) => cases)
    .find(({ attempts }) => attempts.some(({ media }) => media.some(({ url }) => !/^https:/i.test(url))));

  const html = renderCase(localCase);

  assert.match(html, /<video\b[^>]*controls[^>]*playsinline[^>]*preload="none"/);
  assert.match(html, /data-src="assets\/videos\//);
  assert.match(html, /aria-label="[^"]*评审视频/);
  assert.match(html, /class="media-unavailable"/);
  assert.doesNotMatch(html, /<video\b[^>]*\ssrc="/);
});

test("safeUrl rejects executable schemes and userinfo", () => {
  assert.equal(safeUrl("assets/videos/example.mp4"), "assets/videos/example.mp4");
  assert.equal(safeUrl("https://example.com/video.mp4"), "https://example.com/video.mp4");
  assert.throws(() => safeUrl("javascript:alert(1)"), /Unsafe media URL/);
  assert.throws(() => safeUrl("https://user@example.com/video.mp4"), /Unsafe media URL/);
});
