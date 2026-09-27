import assert from "node:assert/strict";
import test from "node:test";

import { validateCreatePayload } from "../../src/client.js";

const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
};

test("Growth Studio accepts a neutral product URL payload without mutation", () => {
  const payload = freeze({
    folder_id: "630251570268735431",
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  });

  assert.doesNotThrow(() => validateCreatePayload(payload));
  assert.deepEqual(payload, {
    folder_id: "630251570268735431",
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  });
});

test("Growth Studio accepts only PixVerse upload URLs for image payloads", () => {
  assert.doesNotThrow(() => validateCreatePayload(freeze({
    product: {
      images: [{ url: "https://media.pixverse.ai/marketing_hub_website/openapi_video_inputs/uploads/example/product.webp" }],
    },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  })));

  assert.throws(() => validateCreatePayload({
    product: { images: [{ url: "https://shop.example.com/product.webp" }] },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  }), /Product images must use URLs returned by the image upload endpoint/);
});

test("Growth Studio rejects unsafe numeric folder IDs before network access", () => {
  assert.throws(() => validateCreatePayload({
    folder_id: 630251570268735431,
    product: { source_url: "https://shop.example.com/products/example-item" },
    video: { aspect_ratio: "9:16", duration_seconds: 15, resolution: "720p" },
  }), /folder_id must be a numeric string/);
});
