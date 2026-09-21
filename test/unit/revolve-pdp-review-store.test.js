import assert from "node:assert/strict";
import test from "node:test";

import { createReviewStore } from "../../deploy/brand-pitches/revolve/pdp-review/review-store.js";

const createMemoryStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
};

test("review store returns immutable snapshots and persists allowed choices", () => {
  const storage = createMemoryStorage();
  const store = createReviewStore({ storage, productIds: ["A", "B"], key: "test" });
  const before = store.snapshot();
  const after = store.set("A", "prefer-b");

  assert.deepEqual(before, {});
  assert.deepEqual(after, { A: "prefer-b" });
  assert.notEqual(before, after);
  assert.ok(Object.isFrozen(after));
  assert.equal(store.get("A"), "prefer-b");
  assert.equal(store.reviewedCount(), 1);
  assert.deepEqual(JSON.parse(storage.getItem("test")), { A: "prefer-b" });
});

test("review store restores only known products and choices", () => {
  const storage = createMemoryStorage({
    test: JSON.stringify({ A: "tie", B: "unknown", PRIVATE: "prefer-a" }),
  });
  const store = createReviewStore({ storage, productIds: ["A", "B"], key: "test" });

  assert.deepEqual(store.snapshot(), { A: "tie" });
  assert.equal(store.get("B"), null);
  assert.equal(store.reviewedCount(), 1);
});

test("review store rejects unknown products and choices without changing state", () => {
  const store = createReviewStore({
    storage: createMemoryStorage(),
    productIds: ["A"],
    key: "test",
  });

  assert.throws(() => store.set("B", "prefer-a"), /Unknown product/);
  assert.throws(() => store.set("A", "winner"), /Unknown review choice/);
  assert.deepEqual(store.snapshot(), {});
});

test("review store ignores corrupt persisted JSON", () => {
  const storage = createMemoryStorage({ test: "{not-json" });
  const store = createReviewStore({ storage, productIds: ["A"], key: "test" });
  assert.deepEqual(store.snapshot(), {});
});

test("storage failures fall back to in-memory state", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const store = createReviewStore({ storage, productIds: ["A"], key: "test" });

  assert.deepEqual(store.set("A", "needs-review"), { A: "needs-review" });
  assert.equal(store.get("A"), "needs-review");
  assert.equal(store.reviewedCount(), 1);
});

test("review store validates constructor inputs", () => {
  assert.throws(
    () => createReviewStore({ storage: null, productIds: ["A"], key: "test" }),
    /storage/,
  );
  assert.throws(
    () => createReviewStore({ storage: createMemoryStorage(), productIds: ["A", "A"], key: "test" }),
    /unique/,
  );
  assert.throws(
    () => createReviewStore({ storage: createMemoryStorage(), productIds: [], key: "" }),
    /key/,
  );
});
