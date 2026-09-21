import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { validateComparisonCatalog } from "../../deploy/brand-pitches/revolve/pdp-review/data-model.js";
import {
  escapeHtml,
  renderComparisonRows,
} from "../../deploy/brand-pitches/revolve/pdp-review/render.js";

const catalogUrl = new URL(
  "../../deploy/brand-pitches/revolve/pdp-review/catalog.json",
  import.meta.url,
);

const fixture = async () => validateComparisonCatalog(
  JSON.parse(await fs.readFile(catalogUrl, "utf8")),
);

test("renderer emits fourteen semantic rows and equal A/B players", async () => {
  const html = renderComparisonRows(await fixture());

  assert.equal((html.match(/class="comparison-row"/g) ?? []).length, 14);
  assert.equal((html.match(/<video\b/g) ?? []).length, 28);
  assert.equal((html.match(/<fieldset\b/g) ?? []).length, 28);
  assert.equal((html.match(/<fieldset class="review-group"/g) ?? []).length, 14);
  assert.equal((html.match(/class="source-label">A — 0911 Original/g) ?? []).length, 14);
  assert.equal((html.match(/class="source-label">B — PDP Standard\/high/g) ?? []).length, 14);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 28);
  assert.equal((html.match(/playsinline/g) ?? []).length, 28);
});

test("renderer produces unique product anchors and review radio groups", async () => {
  const catalog = await fixture();
  const html = renderComparisonRows(catalog);

  for (const { id } of catalog.products) {
    assert.equal((html.match(new RegExp(`id="product-${id}"`, "g")) ?? []).length, 1);
    assert.equal((html.match(new RegExp(`name="review-${id}"`, "g")) ?? []).length, 4);
  }
  for (const choice of ["prefer-a", "prefer-b", "tie", "needs-review"]) {
    assert.equal((html.match(new RegExp(`value="${choice}"`, "g")) ?? []).length, 14);
  }
});

test("renderer includes source-specific labels, direct links, and deferred posters", async () => {
  const catalog = await fixture();
  const html = renderComparisonRows(catalog);

  assert.equal((html.match(/data-source-key="original0911"/g) ?? []).length, 14);
  assert.equal((html.match(/data-source-key="pdpStandardHigh"/g) ?? []).length, 14);
  assert.equal((html.match(/data-poster="\.\/assets\/posters\//g) ?? []).length, 28);
  assert.equal((html.match(/\sposter=/g) ?? []).length, 0);
  assert.doesNotMatch(html, /\son[a-z]+=/i);

  for (const product of catalog.products) {
    assert.match(html, new RegExp(product.productUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    for (const source of Object.values(product.sources)) {
      const escaped = source.videoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.equal((html.match(new RegExp(escaped, "g")) ?? []).length, 2);
    }
  }
});

test("renderer escapes product text before interpolation", async () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
  );

  const catalog = structuredClone(await fixture());
  catalog.products[0].name = `<script>alert("x")</script>`;
  const html = renderComparisonRows(catalog);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
});

test("renderer rejects an invalid catalog", () => {
  assert.throws(() => renderComparisonRows({ products: [] }), /schemaVersion|catalog/i);
});
