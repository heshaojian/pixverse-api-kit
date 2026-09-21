import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  renderCase,
  renderLedger,
  renderProductDirectory,
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
  assert.match(html, /<details class="complete-review-record"/);
  assert.match(html, /完整评审记录/);
  assert.doesNotMatch(html, /name="accordion"/);
});

test("case summary keeps implementation detail in the complete review record", async () => {
  const fixture = await readFixture();
  const html = renderCase(fixture.chapters[0].cases[0]);
  const recordStart = html.indexOf('<details class="complete-review-record"');

  assert.ok(recordStart > 0);
  assert.ok(html.indexOf("提示词：") > recordStart);
  assert.ok(html.indexOf("attempt-parameters") > recordStart);
  assert.ok(html.indexOf("review-summary") < recordStart);
  assert.ok(html.indexOf("review-observations") < recordStart);
  assert.match(html.slice(0, recordStart), /representative-evidence/);
});

test("rendered external links are HTTPS and noreferrer", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);

  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
    assert.match(tag, /href="https:\/\//);
    assert.match(tag, /rel="noreferrer"/);
  }
});

test("product directory renders ten reviewed mappings without source leakage", async () => {
  const fixture = await readFixture();
  const html = renderProductDirectory(fixture);
  const urls = [...html.matchAll(/href="(https:\/\/detail\.vip\.com\/[^"]+)"/g)]
    .map(([, url]) => url);

  assert.equal((html.match(/class="product-directory-link"/g) ?? []).length, 10);
  assert.equal(new Set(urls).size, 9);
  assert.match(html, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(html, /L6sbdC5j3obuDoxrpcYcwGySn2e|feishu\.cn/);
});

test("linked cases surface the exact product before complete review details", async () => {
  const fixture = await readFixture();
  const linked = fixture.chapters.flatMap(({ cases }) => cases)
    .find(({ id }) => id === "creative-skincare-ice");
  const unlinked = fixture.chapters.flatMap(({ cases }) => cases)
    .find(({ id }) => id === "presenter-mens-jeans");
  const linkedHtml = renderCase(linked);
  const unlinkedHtml = renderCase(unlinked);

  assert.match(linkedHtml, /查看唯品会商品详情/);
  assert.ok(linkedHtml.indexOf("查看唯品会商品详情") < linkedHtml.indexOf("完整评审记录"));
  assert.match(linkedHtml, /href="https:\/\/detail\.vip\.com\/detail-1711533687-6922097426018636437\.html"/);
  assert.doesNotMatch(unlinkedHtml, /case-product-link|查看唯品会商品详情/);
});

test("renderCase refuses a product link outside the verified VIPS detail route", async () => {
  const fixture = await readFixture();
  const record = structuredClone(fixture.chapters[0].cases[0]);
  record.inputs.find(({ type }) => type === "link").url = "https://example.com/detail-0-6921774026741411905.html";

  assert.throws(() => renderCase(record), /VIPS product URL/i);
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

test("rendered media reserves validated intrinsic dimensions", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);
  const dimensioned = fixture.chapters.flatMap(({ cases }) => cases)
    .flatMap(({ inputs, attempts }) => [...inputs, ...attempts.flatMap(({ media }) => media)])
    .find(({ dimensions }) => dimensions.width !== null);

  assert.match(html, new RegExp(`width="${dimensioned.dimensions.width}"`));
  assert.match(html, new RegExp(`height="${dimensioned.dimensions.height}"`));
  assert.doesNotMatch(html, /style="[^"]*aspect-ratio/);
});

test("attempt ids are composite and globally unique", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);
  const expectedAttempts = fixture.chapters.flatMap(({ cases }) => cases)
    .reduce((total, { attempts }) => total + attempts.length, 0);
  const ids = [...html.matchAll(/<li class="attempt" id="([^"]+--[^"]+)"/g)]
    .map((match) => match[1]);

  assert.equal(ids.length, expectedAttempts);
  assert.equal(new Set(ids).size, ids.length);
});

test("chapters are collapsed native disclosures", async () => {
  const fixture = await readFixture();
  const html = renderLedger(fixture);

  assert.equal((html.match(/<details class="ledger-chapter"/g) ?? []).length, 5);
  assert.equal((html.match(/<summary class="chapter-summary">/g) ?? []).length, 5);
  assert.doesNotMatch(html, /<details class="ledger-chapter"[^>]*\sopen/);
});

test("safeUrl rejects executable schemes and userinfo", () => {
  assert.equal(safeUrl("assets/videos/example.mp4"), "assets/videos/example.mp4");
  assert.equal(safeUrl("https://example.com/video.mp4"), "https://example.com/video.mp4");
  assert.throws(() => safeUrl("javascript:alert(1)"), /Unsafe media URL/);
  assert.throws(() => safeUrl("https://user@example.com/video.mp4"), /Unsafe media URL/);
});
