import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
const dataPath = path.join(pitchRoot, "data/cases.json");
const expectedCounts = Object.freeze({
  "viral-remix-and-editing": 11,
  "presenter-commerce": 3,
  "creative-commercial": 3,
  "product-motion": 9,
  "outfit-generation": 3,
});
const allowedVerdicts = new Set([
  "capable",
  "partially-capable",
  "not-recommended",
  "not-evaluated",
]);
const allowedSourceKinds = new Set([
  "original-input",
  "benchmark-output",
  "reference-output",
  "reviewed-output",
]);
const inputSourceKinds = new Set(["original-input", "benchmark-output"]);
const attemptSourceKinds = new Set(["reference-output", "reviewed-output"]);

const readData = async () => JSON.parse(await fs.readFile(dataPath, "utf8"));

test("VIPS corpus preserves the exact reviewed scope", async () => {
  const data = await readData();
  assert.equal(data.schemaVersion, "vips-pitch.v1");
  assert.equal(data.source.revisionId, 1214);
  assert.equal(data.source.reviewedAt, "2026-09-20");
  assert.equal(data.chapters.length, 5);

  const ids = data.chapters.flatMap(({ cases }) => cases.map(({ id }) => id));
  assert.equal(ids.length, 29);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    Object.fromEntries(data.chapters.map(({ id, cases }) => [id, cases.length])),
    expectedCounts,
  );
});

test("every case retains evidence and attempt-level review", async () => {
  const data = await readData();
  for (const chapter of data.chapters) {
    assert.ok(allowedVerdicts.has(chapter.verdict), chapter.id);
    assert.ok(chapter.summary.trim(), chapter.id);
    for (const field of ["strengths", "limitations", "operatingConditions"]) {
      assert.ok(Array.isArray(chapter[field]) && chapter[field].length > 0, `${chapter.id}.${field}`);
      assert.ok(chapter[field].every((value) => typeof value === "string" && value.trim()), field);
    }
    for (const record of chapter.cases) {
      assert.ok(record.title.trim(), record.id);
      assert.ok(record.request.trim(), record.id);
      assert.ok(allowedVerdicts.has(record.review.verdict), record.id);
      assert.ok(record.review.summary.trim(), record.id);
      assert.ok(record.inputs.length + record.attempts.length > 0, record.id);
      assert.ok(record.attempts.every((attempt) =>
        attempt.label && Array.isArray(attempt.media) && Array.isArray(attempt.observations)
      ), record.id);
    }
  }
});

test("three featured cases represent distinct workflow chapters", async () => {
  const data = await readData();
  assert.equal(data.featuredCaseIds.length, 3);
  const chapterByCase = new Map(data.chapters.flatMap((chapter) =>
    chapter.cases.map((record) => [record.id, chapter.id])
  ));
  const featuredChapters = data.featuredCaseIds.map((id) => chapterByCase.get(id));
  assert.ok(featuredChapters.every(Boolean), "every featured case id must resolve");
  assert.equal(new Set(featuredChapters).size, 3);
});

test("media has stable ids, explicit dimensions, and valid attempt relationships", async () => {
  const data = await readData();
  const mediaIds = [];
  let knownDimensionCount = 0;
  for (const chapter of data.chapters) {
    for (const record of chapter.cases) {
      for (const media of record.inputs) {
        assert.ok(media.id?.startsWith(`${record.id}-input-`), media.id);
        assert.ok(allowedSourceKinds.has(media.sourceKind), media.id);
        assert.ok(inputSourceKinds.has(media.sourceKind), `${media.id}:${media.sourceKind}`);
        assertDimensions(media);
        knownDimensionCount += Number(media.dimensions.width !== null);
        mediaIds.push(media.id);
      }
      for (const attempt of record.attempts) {
        for (const media of attempt.media) {
          assert.ok(media.id?.startsWith(`${record.id}-${attempt.id}-media-`), media.id);
          assert.ok(allowedSourceKinds.has(media.sourceKind), media.id);
          assert.ok(attemptSourceKinds.has(media.sourceKind), `${media.id}:${media.sourceKind}`);
          assertDimensions(media);
          knownDimensionCount += Number(media.dimensions.width !== null);
          mediaIds.push(media.id);
        }
      }
    }
  }
  assert.equal(new Set(mediaIds).size, mediaIds.length, "media ids must be globally unique");
  assert.ok(knownDimensionCount >= 50, "known source dimensions must not be discarded");
});

test("Agent storyboard images remain attached to their creative attempts", async () => {
  const data = await readData();
  const cases = new Map(data.chapters.flatMap(({ cases: records }) =>
    records.map((record) => [record.id, record])
  ));
  for (const id of ["creative-cyber-sneaker", "creative-skincare-ice"]) {
    const record = cases.get(id);
    assert.ok(record, id);
    assert.equal(record.inputs.some(({ sourceKind }) => sourceKind === "reference-output"), false, id);
    const agentAttempt = record.attempts.find(({ method }) => method === "PixVerse Agent");
    assert.ok(agentAttempt, `${id}:agent`);
    const storyboard = agentAttempt.media.find(({ type, sourceKind }) =>
      type === "image" && sourceKind === "reference-output"
    );
    assert.ok(storyboard, `${id}:storyboard`);
    assert.ok(storyboard.dimensions.width > 0 && storyboard.dimensions.height > 0, `${id}:dimensions`);
  }
});

test("prompt-only baseline is explicitly not evaluated", async () => {
  const data = await readData();
  const baseline = data.chapters.flatMap(({ cases }) => cases)
    .find(({ id }) => id === "product-motion-prompt-baseline");
  assert.ok(baseline);
  assert.equal(baseline.review.verdict, "not-evaluated");
  assert.equal(baseline.attempts.length, 1);
  assert.equal(baseline.attempts[0].verdict, "not-evaluated");
  assert.equal(baseline.attempts[0].media.length, 0);
  assert.match(baseline.attempts[0].label, /提示词基线/);
  assert.match(baseline.review.summary, /未附|未评估|未产出/);
});

test("deployable data excludes confidential and executable references", async () => {
  const raw = await fs.readFile(dataPath, "utf8");
  assert.doesNotMatch(raw, /YEE4dcLZAoiZC9x9vhzcZKLknsc|token=|file_token|\/Users\/|mh_live_|API-KEY/i);
  assert.doesNotMatch(raw, /app\.pixverse\.ai|(?:job|asset|video)[_-]?id\s*[:=]/i);
  assert.doesNotMatch(raw, /(?:href|src)\\?"?\s*:\s*\\?"?(?:javascript:|data:text\/html)/i);
});

function assertDimensions(media) {
  assert.ok(media.dimensions && typeof media.dimensions === "object", `${media.id}:dimensions`);
  const { width, height, aspectRatio } = media.dimensions;
  assert.ok(width === null || (Number.isInteger(width) && width > 0), `${media.id}:width`);
  assert.ok(height === null || (Number.isInteger(height) && height > 0), `${media.id}:height`);
  assert.ok(aspectRatio === null || (typeof aspectRatio === "number" && aspectRatio > 0), `${media.id}:aspect`);
  assert.equal(width === null, height === null, `${media.id}:partial dimensions`);
  assert.equal(width === null, aspectRatio === null, `${media.id}:partial aspect ratio`);
  if (width !== null) {
    assert.ok(Math.abs(aspectRatio - (width / height)) < 0.0001, `${media.id}:aspect ratio mismatch`);
  }
}
