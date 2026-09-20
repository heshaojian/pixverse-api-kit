import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const pagePath = path.join(pitchRoot, "index.html");

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
  assert.match(html, /真实商品，真实测试，人工评审/);
  assert.ok(position(html, 'id="featured"') < position(html, 'id="capabilities"'));
  assert.ok(position(html, 'id="capabilities"') < position(html, 'id="ledger"'));
  assert.ok(position(html, 'id="ledger"') < position(html, 'id="pilot"'));
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /1214/);
});

test("VIPS page exposes one decision and one primary action", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*primary-action/g) ?? []).length, 1);
  assert.match(html, /href="#pilot"[^>]*>\s*选择试点工作流\s*</);
  assert.match(visibleText(html), /选择三个优先电商工作流/);
  assert.doesNotMatch(visibleText(html), /价格|SLA|已约定|保证|承诺/);
});

test("three featured cases remain usable without JavaScript", async () => {
  const html = await readPage();
  assert.equal((html.match(/class="[^"]*featured-case/g) ?? []).length, 3);
  assert.equal((html.match(/preload="metadata"/g) ?? []).length, 1);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 2);
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
  for (const label of ["重点结果", "能力总览", "完整评审", "建议试点"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(visibleText(html), /私人能力提案/);
  assert.match(visibleText(html), /不代表唯品会公开背书/);
  assert.doesNotMatch(visibleText(html), /YEE4dcLZAoiZC9x9vhzcZKLknsc|job[_ -]?id|video[_ -]?id|token/i);
});
