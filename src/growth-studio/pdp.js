export const PDP_WIRE_TYPE = "ecommerce_fashion_pdp";
export const PDP_CREATE_PATH = "/openapi/v1/ka/videos";

const ROOT_FIELDS = new Set(["product", "video"]);
const PRODUCT_FIELDS = new Set(["title", "description", "images", "brand", "price"]);
const IMAGE_FIELDS = new Set(["url"]);
const PRICE_FIELDS = new Set(["amount", "currency"]);
const VIDEO_FIELDS = new Set(["mode", "duration", "quality", "aspect_ratio", "additional_prompt"]);
const MODES = new Set(["standard", "pro"]);
const QUALITIES = new Set(["normal", "high"]);
const ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);

function assertPlainObject(value, label) {
  const prototype = value === null || typeof value !== "object"
    ? null
    : Object.getPrototypeOf(value);
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertKnownFields(value, allowedFields, label) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new Error(`Unknown ${label} field: ${field}.`);
    }
  }
}

function assertRequiredNonEmptyString(value, label, maximumLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) {
    throw new Error(`${label} must be a non-empty string of at most ${maximumLength} characters.`);
  }
}

function assertOptionalString(value, label, maximumLength) {
  if (value !== undefined && (typeof value !== "string" || value.length > maximumLength)) {
    throw new Error(`${label} must be a string of at most ${maximumLength} characters.`);
  }
}

function assertOptionalEnum(value, label, values) {
  if (value !== undefined && (typeof value !== "string" || !values.has(value))) {
    throw new Error(`${label} must be one of: ${[...values].join(", ")}.`);
  }
}

function hasExplicitPort(rawUrl) {
  const schemeEnd = rawUrl.indexOf("://");
  if (schemeEnd < 0) return false;
  const authority = rawUrl.slice(schemeEnd + 3).split(/[/?#]/, 1)[0];
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  return /:\d+$/.test(hostAndPort);
}

function validateImageUrl(value, index) {
  const label = `product.images[${index}].url`;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials.`);
  }
  if (hasExplicitPort(value) || parsed.port) {
    throw new Error(`${label} must not include an explicit port.`);
  }
  if (parsed.hostname !== "media.pixverse.ai" || parsed.origin !== "https://media.pixverse.ai") {
    throw new Error(`${label} must use the media.pixverse.ai origin.`);
  }
}

function validateProduct(product) {
  assertPlainObject(product, "PDP product");
  assertKnownFields(product, PRODUCT_FIELDS, "PDP product");

  assertRequiredNonEmptyString(product.title, "product.title", 255);
  assertOptionalString(product.description, "product.description", 5_120);
  assertOptionalString(product.brand, "product.brand", 255);

  if (!Array.isArray(product.images)) {
    throw new Error("product.images must be an array containing 1 to 8 entries.");
  }
  if (product.images.length < 1 || product.images.length > 8) {
    throw new Error("product.images must contain 1 to 8 entries.");
  }
  product.images.forEach((image, index) => {
    assertPlainObject(image, "PDP product image");
    assertKnownFields(image, IMAGE_FIELDS, "PDP product image");
    validateImageUrl(image.url, index);
  });

  if (product.price !== undefined) {
    assertPlainObject(product.price, "PDP product price");
    assertKnownFields(product.price, PRICE_FIELDS, "PDP product price");
    if (typeof product.price.amount !== "string") {
      throw new Error("product.price.amount must be a string.");
    }
    if (typeof product.price.currency !== "string" || !/^[A-Z]{3}$/.test(product.price.currency)) {
      throw new Error("product.price.currency must be an uppercase three-letter string.");
    }
  }
}

function validateVideo(video) {
  assertPlainObject(video, "PDP video");
  assertKnownFields(video, VIDEO_FIELDS, "PDP video");

  if (typeof video.mode !== "string" || !MODES.has(video.mode)) {
    throw new Error("video.mode must be one of: standard, pro.");
  }
  if (
    video.duration !== undefined
    && (!Number.isInteger(video.duration) || video.duration < 5 || video.duration > 10)
  ) {
    throw new Error("video.duration must be an integer from 5 through 10.");
  }
  assertOptionalEnum(video.quality, "video.quality", QUALITIES);
  assertOptionalEnum(video.aspect_ratio, "video.aspect_ratio", ASPECT_RATIOS);
  assertOptionalString(video.additional_prompt, "video.additional_prompt", 2_000);
}

export function validatePdpPayload(payload) {
  assertPlainObject(payload, "PDP payload");
  assertKnownFields(payload, ROOT_FIELDS, "PDP");
  if (payload.product === undefined) {
    throw new Error("PDP payload requires product.");
  }
  validateProduct(payload.product);
  if (payload.video !== undefined && payload.video !== null) {
    validateVideo(payload.video);
  }
}

export function normalizePdpPayload(payload) {
  validatePdpPayload(payload);
  return {
    type: PDP_WIRE_TYPE,
    product: normalizeProduct(payload.product),
    ...(payload.video === undefined || payload.video === null
      ? {}
      : { video: { ...payload.video } }),
  };
}

function normalizeProduct(product) {
  return {
    title: product.title,
    ...(product.description === undefined ? {} : { description: product.description }),
    images: product.images.map(({ url }) => ({ url })),
    ...(product.brand === undefined ? {} : { brand: product.brand }),
    ...(product.price === undefined ? {} : { price: { ...product.price } }),
  };
}

export function describePdpDryRun(payload) {
  return {
    capability: "pdp",
    billable: false,
    method: "POST",
    path: PDP_CREATE_PATH,
    body: normalizePdpPayload(payload),
  };
}
