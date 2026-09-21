import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  REVIEW_CHOICES,
  SOURCE_KEYS,
  isSafePublicUrl,
  validateComparisonCatalog,
} from "../../deploy/brand-pitches/revolve/pdp-review/data-model.js";

const catalogUrl = new URL(
  "../../deploy/brand-pitches/revolve/pdp-review/catalog.json",
  import.meta.url,
);

const fixture = async () => JSON.parse(await fs.readFile(catalogUrl, "utf8"));

test("comparison catalog validates without mutating input", async () => {
  const input = await fixture();
  const before = structuredClone(input);
  const result = validateComparisonCatalog(input);

  assert.deepEqual(input, before);
  assert.notEqual(result, input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.products));
  assert.ok(Object.isFrozen(result.products[0].sources));
  assert.equal(result.products.length, 14);
  assert.deepEqual(SOURCE_KEYS, ["original0911", "pdpStandardHigh"]);
  assert.deepEqual(REVIEW_CHOICES, ["prefer-a", "prefer-b", "tie", "needs-review"]);
});

test("comparison catalog rejects unsupported roots and schema drift", async () => {
  assert.throws(() => validateComparisonCatalog(null), /object/);

  const wrongSchema = await fixture();
  wrongSchema.schemaVersion = "revolve-pdp-review.v1";
  assert.throws(() => validateComparisonCatalog(wrongSchema), /schemaVersion/);

  const extra = await fixture();
  extra.privateWorkspace = "not-allowed";
  assert.throws(() => validateComparisonCatalog(extra), /Unexpected catalog field/);
});

test("comparison catalog rejects duplicate, missing, and disordered products", async () => {
  const duplicate = await fixture();
  duplicate.products[1].id = duplicate.products[0].id;
  assert.throws(() => validateComparisonCatalog(duplicate), /Duplicate product id/);

  const missing = await fixture();
  missing.products.pop();
  assert.throws(() => validateComparisonCatalog(missing), /14 products/);

  const disordered = await fixture();
  disordered.products[0].order = 2;
  assert.throws(() => validateComparisonCatalog(disordered), /order/);
});

test("comparison catalog rejects incomplete or mislabeled source pairs", async () => {
  const incomplete = await fixture();
  delete incomplete.products[0].sources.original0911;
  assert.throws(() => validateComparisonCatalog(incomplete), /original0911/);

  const mislabeled = await fixture();
  mislabeled.products[0].sources.pdpStandardHigh.label = "PDP Pro/high";
  assert.throws(() => validateComparisonCatalog(mislabeled), /label/);

  const extraSource = await fixture();
  extraSource.products[0].sources.proHigh = structuredClone(
    extraSource.products[0].sources.pdpStandardHigh,
  );
  assert.throws(() => validateComparisonCatalog(extraSource), /source key/);
});

test("comparison catalog rejects blank fields and unsafe URLs", async () => {
  const blank = await fixture();
  blank.products[0].brand = " ";
  assert.throws(() => validateComparisonCatalog(blank), /brand/);

  const unsafeVideo = await fixture();
  unsafeVideo.products[0].sources.original0911.videoUrl = "javascript:alert(1)";
  assert.throws(() => validateComparisonCatalog(unsafeVideo), /videoUrl/);

  const unsafeProduct = await fixture();
  unsafeProduct.products[0].productUrl = "https://example.com/item/dp/SKU/";
  assert.throws(() => validateComparisonCatalog(unsafeProduct), /productUrl/);

  const unsafePoster = await fixture();
  unsafePoster.products[0].sources.original0911.poster = "../private.jpg";
  assert.throws(() => validateComparisonCatalog(unsafePoster), /poster/);
});

test("safe public URL policy is host-specific and credential-free", () => {
  assert.equal(
    isSafePublicUrl("https://media.pixverse.ai/upload%2Fclip.mp4", "video"),
    true,
  );
  assert.equal(
    isSafePublicUrl("https://www.revolve.com/item/dp/SKU/", "product"),
    true,
  );
  assert.equal(isSafePublicUrl("./assets/posters/0911/SKU-1.jpg", "poster"), true);
  assert.equal(isSafePublicUrl("https://example.com/clip.mp4", "video"), false);
  assert.equal(isSafePublicUrl("//media.pixverse.ai/clip.mp4", "video"), false);
  assert.equal(isSafePublicUrl("https://user:pass@media.pixverse.ai/clip.mp4", "video"), false);
  assert.equal(isSafePublicUrl("https://media.pixverse.ai/clip.mp4?token=secret", "video"), false);
  assert.equal(isSafePublicUrl("https://media.pixverse.ai/clip.mp4#preview", "video"), false);
  assert.equal(isSafePublicUrl("./assets/posters/../private.jpg", "poster"), false);
  assert.equal(isSafePublicUrl("", "video"), false);
  assert.equal(isSafePublicUrl("https://%", "video"), false);
});
