export const SOURCE_KEYS = Object.freeze(["original0911", "pdpStandardHigh"]);
export const REVIEW_CHOICES = Object.freeze([
  "prefer-a",
  "prefer-b",
  "tie",
  "needs-review",
]);

const EXPECTED_SOURCE_LABELS = Object.freeze({
  original0911: "A — 0911 Original",
  pdpStandardHigh: "B — PDP Standard/high",
});

const ROOT_FIELDS = Object.freeze(["schemaVersion", "title", "canonicalUrl", "products"]);
const PRODUCT_FIELDS = Object.freeze([
  "order",
  "id",
  "brand",
  "name",
  "variant",
  "productUrl",
  "posterTimeSeconds",
  "featured",
  "motionDescription",
  "sources",
]);
const SOURCE_FIELDS = Object.freeze(["label", "videoUrl", "poster"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const assertExactFields = (value, expected, label) => {
  for (const field of Object.keys(value)) {
    if (!expected.includes(field)) throw new Error(`Unexpected ${label} field: ${field}`);
  }
  for (const field of expected) {
    if (!Object.hasOwn(value, field)) throw new Error(`Missing ${label} field: ${field}`);
  }
};

const assertString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
};

const deepFreeze = (value) => {
  if (!isObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export function isSafePublicUrl(value, kind) {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  if (kind === "poster") {
    return /^\.\/assets\/posters\/(?:0911\/)?[A-Z0-9-]+\.jpg$/.test(value);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return false;
    }
    if (kind === "video") {
      return url.hostname === "media.pixverse.ai" && url.pathname.toLowerCase().endsWith(".mp4");
    }
    return kind === "product"
      && url.hostname === "www.revolve.com"
      && url.pathname.includes("/dp/");
  } catch {
    return false;
  }
}

const validateSource = (source, sourceKey, productId) => {
  const label = `${productId}.sources.${sourceKey}`;
  if (!isObject(source)) throw new Error(`${label} must be an object`);
  assertExactFields(source, SOURCE_FIELDS, `${label}`);
  assertString(source.label, `${label}.label`);
  if (source.label !== EXPECTED_SOURCE_LABELS[sourceKey]) {
    throw new Error(`${label}.label must be ${EXPECTED_SOURCE_LABELS[sourceKey]}`);
  }
  if (!isSafePublicUrl(source.videoUrl, "video")) {
    throw new Error(`${label}.videoUrl is unsafe`);
  }
  if (!isSafePublicUrl(source.poster, "poster")) {
    throw new Error(`${label}.poster is unsafe`);
  }
};

const validateProduct = (product, index) => {
  const label = `products[${index}]`;
  if (!isObject(product)) throw new Error(`${label} must be an object`);
  assertExactFields(product, PRODUCT_FIELDS, label);
  if (product.order !== index + 1) throw new Error(`${label}.order must be ${index + 1}`);
  for (const field of ["id", "brand", "name", "variant", "motionDescription"]) {
    assertString(product[field], `${label}.${field}`);
  }
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(product.id)) throw new Error(`${label}.id is invalid`);
  if (!isSafePublicUrl(product.productUrl, "product")) {
    throw new Error(`${label}.productUrl is unsafe`);
  }
  if (!Number.isFinite(product.posterTimeSeconds) || product.posterTimeSeconds < 0) {
    throw new Error(`${label}.posterTimeSeconds must be a non-negative number`);
  }
  if (typeof product.featured !== "boolean") throw new Error(`${label}.featured must be boolean`);
  if (!isObject(product.sources)) throw new Error(`${label}.sources must be an object`);
  const sourceKeys = Object.keys(product.sources);
  for (const sourceKey of SOURCE_KEYS) {
    if (!Object.hasOwn(product.sources, sourceKey)) {
      throw new Error(`${label}.sources.${sourceKey} is required`);
    }
    validateSource(product.sources[sourceKey], sourceKey, product.id);
  }
  if (sourceKeys.length !== SOURCE_KEYS.length || sourceKeys.some((key) => !SOURCE_KEYS.includes(key))) {
    throw new Error(`${label} has an unexpected source key`);
  }
};

export function validateComparisonCatalog(input) {
  if (!isObject(input)) throw new Error("Comparison catalog must be an object");
  assertExactFields(input, ROOT_FIELDS, "catalog");
  if (input.schemaVersion !== "revolve-pdp-review.v2") {
    throw new Error("Unsupported schemaVersion");
  }
  assertString(input.title, "title");
  if (input.canonicalUrl !== "https://revolve-pdp-review.pages.dev/") {
    throw new Error("canonicalUrl is invalid");
  }
  if (!Array.isArray(input.products) || input.products.length !== 14) {
    throw new Error("Comparison catalog must contain exactly 14 products");
  }
  input.products.forEach(validateProduct);
  const ids = input.products.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate product id");
  return deepFreeze(structuredClone(input));
}
