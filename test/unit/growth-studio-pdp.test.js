import assert from "node:assert/strict";
import test from "node:test";

import {
  PDP_CREATE_PATH,
  PDP_WIRE_TYPE,
  describePdpDryRun,
  normalizePdpPayload,
  validatePdpPayload,
} from "../../src/growth-studio/pdp.js";

function validPayload(overrides = {}) {
  return {
    product: {
      title: "Linen Summer Shirt",
      description: "Breathable linen with a relaxed fit.",
      images: [
        { url: "https://media.pixverse.ai/example/front.webp" },
        { url: "https://media.pixverse.ai/example/back.webp" },
      ],
      brand: "Example Brand",
      price: { amount: "59.90", currency: "USD" },
      ...overrides.product,
    },
    video: {
      mode: "pro",
      duration: 10,
      quality: "high",
      aspect_ratio: "9:16",
      additional_prompt: "Soft morning light and clean product-focused styling.",
      ...overrides.video,
    },
    ...overrides.root,
  };
}

function minimalPayload() {
  return {
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "standard" },
  };
}

test("PDP normalization injects the private wire type without mutating caller input", () => {
  const payload = validPayload();
  const snapshot = structuredClone(payload);

  const normalized = normalizePdpPayload(payload);

  assert.deepEqual(payload, snapshot);
  assert.notEqual(normalized.product, payload.product);
  assert.notEqual(normalized.video, payload.video);
  assert.notEqual(normalized.product.images, payload.product.images);
  assert.notEqual(normalized.product.images[0], payload.product.images[0]);
  assert.notEqual(normalized.product.price, payload.product.price);
  assert.equal(normalized.type, PDP_WIRE_TYPE);
  assert.deepEqual(normalized.product, payload.product);
  assert.deepEqual(normalized.video, payload.video);

  normalized.product.images[0].url = "https://media.pixverse.ai/example/changed.webp";
  normalized.product.price.amount = "1.00";
  normalized.video.mode = "standard";
  assert.deepEqual(payload, snapshot);
});

test("PDP dry run describes the exact non-billable wire request", () => {
  const result = describePdpDryRun(validPayload());

  assert.equal(result.capability, "pdp");
  assert.equal(result.billable, false);
  assert.equal(result.method, "POST");
  assert.equal(result.path, PDP_CREATE_PATH);
  assert.equal(result.body.type, "ecommerce_fashion_pdp");
});

test("PDP rejects fields that the paid endpoint would ignore or reject", () => {
  const cases = [
    [validPayload({ root: { type: "ecommerce_fashion_pdp" } }), /Unknown PDP field: type/],
    [validPayload({ root: { folder_id: "630251570268735431" } }), /Unknown PDP field: folder_id/],
    [validPayload({ product: { source_url: "https:\/\/shop.example.test\/item" } }), /Unknown PDP product field: source_url/],
    [validPayload({ product: { seller: "Example Seller" } }), /Unknown PDP product field: seller/],
    [validPayload({ video: { resolution: "1080p" } }), /Unknown PDP video field: resolution/],
    [validPayload({ product: { images: [{ url: "https://media.pixverse.ai/item.webp", alt: "front" }] } }), /Unknown PDP product image field: alt/],
    [validPayload({ product: { price: { amount: "59.90", currency: "USD", sale: true } } }), /Unknown PDP product price field: sale/],
  ];

  for (const [payload, message] of cases) {
    assert.throws(() => validatePdpPayload(payload), message);
  }
});

test("PDP requires plain root, product, video, image, and price objects", () => {
  const rootCases = [undefined, null, [], "payload", 42];
  for (const payload of rootCases) {
    assert.throws(() => validatePdpPayload(payload), /PDP payload must be a plain object/);
  }

  assert.throws(
    () => validatePdpPayload({ video: { mode: "standard" } }),
    /PDP payload requires product/,
  );
  assert.throws(
    () => validatePdpPayload({ product: minimalPayload().product }),
    /PDP payload requires video/,
  );

  for (const product of [null, [], "product"]) {
    assert.throws(
      () => validatePdpPayload({ product, video: { mode: "standard" } }),
      /PDP product must be a plain object/,
    );
  }
  for (const video of [null, [], "video"]) {
    assert.throws(
      () => validatePdpPayload({ product: minimalPayload().product, video }),
      /PDP video must be a plain object/,
    );
  }

  for (const image of [null, [], "image"]) {
    assert.throws(
      () => validatePdpPayload(validPayload({ product: { images: [image] } })),
      /PDP product image must be a plain object/,
    );
  }

  for (const price of [null, [], "price"]) {
    assert.throws(
      () => validatePdpPayload(validPayload({ product: { price } })),
      /PDP product price must be a plain object/,
    );
  }
});

test("PDP validates documented string, collection, and enum limits", () => {
  const cases = [
    [validPayload({ product: { title: undefined } }), /product.title/],
    [validPayload({ product: { title: "" } }), /product.title/],
    [validPayload({ product: { title: "   " } }), /product.title/],
    [validPayload({ product: { title: 42 } }), /product.title/],
    [validPayload({ product: { title: "x".repeat(256) } }), /product.title/],
    [validPayload({ product: { description: 42 } }), /product.description/],
    [validPayload({ product: { description: "x".repeat(5121) } }), /product.description/],
    [validPayload({ product: { brand: 42 } }), /product.brand/],
    [validPayload({ product: { brand: "x".repeat(256) } }), /product.brand/],
    [validPayload({ product: { images: undefined } }), /product.images/],
    [validPayload({ product: { images: "image" } }), /product.images/],
    [validPayload({ product: { images: [] } }), /1 to 8/],
    [validPayload({ product: { images: Array.from({ length: 9 }, (_, index) => ({ url: `https:\/\/media.pixverse.ai\/${index}.webp` })) } }), /1 to 8/],
    [validPayload({ product: { images: [{ url: 42 }] } }), /product.images\[0\].url/],
    [validPayload({ product: { images: [{ url: "https://media.pixverse.ai.evil.test/item.webp" }] } }), /media.pixverse.ai/],
    [validPayload({ product: { images: [{ url: "http://media.pixverse.ai/item.webp" }] } }), /HTTPS/],
    [validPayload({ product: { images: [{ url: "not a url" }] } }), /valid URL/],
    [validPayload({ product: { images: [{ url: "https://user@media.pixverse.ai/item.webp" }] } }), /credentials/],
    [validPayload({ product: { images: [{ url: "https://media.pixverse.ai:443/item.webp" }] } }), /port/],
    [validPayload({ product: { images: [{ url: "https://media.pixverse.ai:8443/item.webp" }] } }), /port|media.pixverse.ai/],
    [validPayload({ product: { price: { currency: "USD" } } }), /price.amount/],
    [validPayload({ product: { price: { amount: 59.9, currency: "USD" } } }), /price.amount/],
    [validPayload({ product: { price: { amount: "59.90" } } }), /price.currency/],
    [validPayload({ product: { price: { amount: "59.90", currency: "usd" } } }), /price.currency/],
    [validPayload({ product: { price: { amount: "59.90", currency: "USDX" } } }), /price.currency/],
    [validPayload({ product: { price: { amount: "59.90", currency: 840 } } }), /price.currency/],
    [validPayload({ video: { mode: undefined } }), /video.mode/],
    [validPayload({ video: { mode: "ultra" } }), /video.mode/],
    [validPayload({ video: { mode: 42 } }), /video.mode/],
    [validPayload({ video: { duration: 4 } }), /video.duration/],
    [validPayload({ video: { duration: 11 } }), /video.duration/],
    [validPayload({ video: { duration: 10.5 } }), /video.duration/],
    [validPayload({ video: { duration: "10" } }), /video.duration/],
    [validPayload({ video: { quality: "4k" } }), /video.quality/],
    [validPayload({ video: { quality: 42 } }), /video.quality/],
    [validPayload({ video: { aspect_ratio: "2:1" } }), /video.aspect_ratio/],
    [validPayload({ video: { aspect_ratio: 42 } }), /video.aspect_ratio/],
    [validPayload({ video: { additional_prompt: 42 } }), /video.additional_prompt/],
    [validPayload({ video: { additional_prompt: "x".repeat(2001) } }), /video.additional_prompt/],
  ];

  for (const [payload, message] of cases) {
    assert.throws(() => validatePdpPayload(payload), message);
  }
});

test("PDP accepts the documented minimum payload and omits absent optional fields", () => {
  const payload = minimalPayload();

  assert.doesNotThrow(() => validatePdpPayload(payload));
  assert.deepEqual(normalizePdpPayload(payload), {
    type: PDP_WIRE_TYPE,
    product: {
      title: "Linen Summer Shirt",
      images: [{ url: "https://media.pixverse.ai/example/front.webp" }],
    },
    video: { mode: "standard" },
  });
});

test("PDP accepts every documented aspect ratio, boundary duration, and enum", () => {
  for (const aspectRatio of ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]) {
    assert.doesNotThrow(() => validatePdpPayload(validPayload({
      video: { aspect_ratio: aspectRatio },
    })));
  }
  for (const duration of [5, 10]) {
    assert.doesNotThrow(() => validatePdpPayload(validPayload({ video: { duration } })));
  }
  for (const mode of ["standard", "pro"]) {
    assert.doesNotThrow(() => validatePdpPayload(validPayload({ video: { mode } })));
  }
  for (const quality of ["normal", "high"]) {
    assert.doesNotThrow(() => validatePdpPayload(validPayload({ video: { quality } })));
  }
});

test("PDP accepts documented maximum string lengths and preserves string money", () => {
  const payload = validPayload({
    product: {
      title: "t".repeat(255),
      description: "d".repeat(5120),
      brand: "b".repeat(255),
      price: { amount: "00000000000000000059.90", currency: "USD" },
    },
    video: { additional_prompt: "p".repeat(2000) },
  });

  const normalized = normalizePdpPayload(payload);

  assert.equal(normalized.product.price.amount, "00000000000000000059.90");
  assert.equal(normalized.product.title.length, 255);
  assert.equal(normalized.product.description.length, 5120);
  assert.equal(normalized.product.brand.length, 255);
  assert.equal(normalized.video.additional_prompt.length, 2000);
});

test("PDP dry run applies live validation", () => {
  assert.throws(
    () => describePdpDryRun(validPayload({ root: { metadata: {} } })),
    /Unknown PDP field: metadata/,
  );
});
