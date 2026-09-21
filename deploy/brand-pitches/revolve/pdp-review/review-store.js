import { REVIEW_CHOICES } from "./data-model.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const readPersisted = (storage, key, allowedIds) => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return Object.freeze({});
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return Object.freeze({});
    const validEntries = Object.entries(parsed).filter(([productId, choice]) => (
      allowedIds.has(productId) && REVIEW_CHOICES.includes(choice)
    ));
    return Object.freeze(Object.fromEntries(validEntries));
  } catch {
    return Object.freeze({});
  }
};

export function createReviewStore({ storage, productIds, key }) {
  if (typeof key !== "string" || !key.trim()) throw new Error("Review storage key is required");
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("Review storage must implement getItem and setItem");
  }
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("Review productIds must be a non-empty array");
  }
  if (productIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Review productIds must contain non-empty strings");
  }
  const allowedIds = new Set(productIds);
  if (allowedIds.size !== productIds.length) throw new Error("Review productIds must be unique");

  let state = readPersisted(storage, key, allowedIds);

  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      // Browser storage may be blocked; the frozen in-memory state remains usable.
    }
  };

  return Object.freeze({
    get(productId) {
      return allowedIds.has(productId) && Object.hasOwn(state, productId)
        ? state[productId]
        : null;
    },
    set(productId, choice) {
      if (!allowedIds.has(productId)) throw new Error(`Unknown product: ${productId}`);
      if (!REVIEW_CHOICES.includes(choice)) throw new Error(`Unknown review choice: ${choice}`);
      state = Object.freeze({ ...state, [productId]: choice });
      persist();
      return state;
    },
    snapshot() {
      return state;
    },
    reviewedCount() {
      return Object.keys(state).length;
    },
  });
}
