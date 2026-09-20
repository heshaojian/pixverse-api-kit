import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { attachDesktopPosters } from "../deploy/brand-pitches/vips/human-reviewed-ecommerce/app.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const pagePath = path.join(pitchRoot, "index.html");
const cssPath = path.join(pitchRoot, "styles.css");
const appPath = path.join(pitchRoot, "app.js");

const readPage = async () => fs.readFile(pagePath, "utf8");
const position = (html, needle) => {
  const index = html.indexOf(needle);
  assert.notEqual(index, -1, `${needle} should exist`);
  return index;
};
const visibleText = (html) => html
  .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
  .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
  .replaceAll(/<[^>]+>/g, " ")
  .replaceAll(/\s+/g, " ")
  .trim();

test("VIPS page follows the approved Chinese proof-first story", async () => {
  const html = await readPage();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /从真实商品样例中，选择三条最值得试点的电商视频工作流/);
  assert.match(html, /class="hero-proof"/);
  assert.ok(position(html, 'id="featured"') < position(html, 'id="capabilities"'));
  assert.ok(position(html, 'id="capabilities"') < position(html, 'id="pilot"'));
  assert.ok(position(html, 'id="pilot"') < position(html, 'id="ledger"'));
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /1214/);
});

test("VIPS page exposes one decision and one primary action", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*primary-action/g) ?? []).length, 1);
  assert.match(html, /id="copy-pilot"[^>]*disabled[^>]*>\s*复制试点方案\s*</);
  assert.match(visibleText(html), /选择三个优先电商工作流/);
  assert.equal((html.match(/name="pilot-workflow"/g) ?? []).length, 5);
  assert.match(html, /id="selection-count"[^>]*>\s*已选择 0 \/ 3\s*</);
  assert.match(html, /id="copy-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="manual-copy"[^>]*hidden/);
  assert.doesNotMatch(visibleText(html), /价格|SLA|已约定|保证|承诺/);
});

test("three featured cases remain usable without JavaScript", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*featured-case/g) ?? []).length, 2);
  assert.equal((html.match(/class="hero-proof"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 2);
  assert.match(
    html,
    /preload="metadata"[^>]*poster="\.\/assets\/images\/featured-product-motion-poster\.jpg"/,
  );
  assert.equal((html.match(/data-desktop-poster="\.\/assets\/images\/featured-(?:presenter|creative)-poster\.jpg"/g) ?? []).length, 2);
  assert.equal((html.match(/\sposter="\.\/assets\/images\/featured-(?:presenter|creative)-poster\.jpg"/g) ?? []).length, 0);
  assert.match(html, /男式牛仔裤/);
  assert.match(html, /冰晶护肤/);
  assert.match(html, /商品动效/);
});

test("VIPS page has private provenance and semantic navigation", async () => {
  const html = await readPage();
  assert.match(html, /href="#main"[^>]*>跳到正文/);
  assert.match(html, /<header class="site-header"/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<footer/);
  for (const label of ["重点结果", "选择试点", "完整评审", "建议试点"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(visibleText(html), /私人能力提案/);
  assert.match(visibleText(html), /不代表唯品会公开背书/);
  assert.doesNotMatch(visibleText(html), /YEE4dcLZAoiZC9x9vhzcZKLknsc|job[_ -]?id|video[_ -]?id|token/i);
});

test("VIPS styles follow PixVerse tokens and product-media constraints", async () => {
  const css = await fs.readFile(cssPath, "utf8");
  assert.match(css, /--background-primary:\s*#000000/);
  assert.match(css, /--text-secondary:\s*rgba\(255, 255, 255, 0\.6\)/);
  assert.match(css, /--create:\s*linear-gradient\(90deg, #ffa052 0%, #e046a4 45%, #6851eb 100%\)/);
  assert.match(css, /font-family:\s*"Plus Jakarta Sans"/);
  assert.match(css, /font-family:\s*"Inconsolata"/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /\.hero-layout/);
  assert.match(css, /\.workflow-grid[\s\S]*grid-template-columns:\s*repeat\(5/);
  assert.match(css, /\.evidence-media video[\s\S]*object-fit:\s*contain/);
  assert.match(css, /video:-webkit-full-screen[\s\S]*object-fit:\s*contain/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(max-width:\s*639px\)/);
  assert.doesNotMatch(css, /box-shadow\s*:|object-fit:\s*cover|letter-spacing\s*:/);
});

test("VIPS app safely renders and progressively loads the ledger", async () => {
  const source = await fs.readFile(appPath, "utf8");
  const imports = [...source.matchAll(/import\s+[^;]+?\s+from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.length >= 2);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")), imports.join(", "));
  assert.match(source, /const DATA_URL = "\.\/data\/cases\.json"/);
  assert.ok(source.indexOf("validatePitchData") < source.indexOf("renderLedger"));
  assert.doesNotMatch(source, /innerHTML\s*=|eval\s*\(|new Function|analytics|gtag|fetch\(["']https?:|form\.submit|app\.pixverse\.ai/i);
  assert.match(source, /document\.createElement\("template"\)/);
  assert.match(source, /replaceChildren\(/);
  assert.match(source, /new IntersectionObserver\(/);
  assert.match(source, /rootMargin:\s*"[^"]*[1-9]\d*px/);
  assert.match(source, /dataset\.src[\s\S]*setAttribute\("src"/);
  assert.match(source, /dataset\.poster[\s\S]*setAttribute\("poster"/);
  assert.match(source, /attachDeferredMedia/);
  assert.match(source, /matchMedia\("\(min-width: 900px\)"\)/);
  assert.match(source, /dataset\.desktopPoster[\s\S]*setAttribute\("poster"/);
  assert.doesNotMatch(source, /innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/);
  assert.match(source, /addEventListener\("error"/);
  assert.match(source, /视频暂不可用/);
  assert.match(source, /完整评审暂不可用，请稍后重试。/);
});

test("featured posters preserve the mobile request budget and use a desktop allowlist", () => {
  const makeVideo = (desktopPoster) => ({
    dataset: { desktopPoster },
    poster: null,
    setAttribute(name, value) {
      if (name === "poster") this.poster = value;
    },
  });
  const videos = [
    makeVideo("./assets/images/featured-presenter-poster.jpg"),
    makeVideo("./assets/images/featured-creative-poster.jpg"),
    makeVideo("https://example.invalid/untrusted.jpg"),
  ];
  const root = { querySelectorAll: () => videos };
  const mobileQuery = { matches: false, addEventListener() {}, removeEventListener() {} };
  const desktopQuery = { matches: true, addEventListener() {}, removeEventListener() {} };

  assert.equal(attachDesktopPosters(root, mobileQuery), 0);
  assert.deepEqual(videos.map(({ poster }) => poster), [null, null, null]);
  assert.equal(attachDesktopPosters(root, desktopQuery), 2);
  assert.deepEqual(videos.map(({ poster }) => poster), [
    "./assets/images/featured-presenter-poster.jpg",
    "./assets/images/featured-creative-poster.jpg",
    null,
  ]);
});
