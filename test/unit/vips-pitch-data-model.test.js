import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPilotSummary,
  flattenCases,
  getFeaturedCases,
  getVerdictMeta,
  isSafeMediaUrl,
  resolveEvidenceTarget,
  toAttemptDomId,
  toggleWorkflowSelection,
  validatePitchData,
} from "../../deploy/brand-pitches/vips/human-reviewed-ecommerce/data-model.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = path.join(
  repoRoot,
  "deploy/brand-pitches/vips/human-reviewed-ecommerce/data/cases.json",
);

const readFixture = async () => JSON.parse(await fs.readFile(fixturePath, "utf8"));

test("validatePitchData accepts the reviewed VIPS corpus without mutating it", async () => {
  const fixture = await readFixture();
  const before = structuredClone(fixture);
  const validated = validatePitchData(fixture);

  assert.deepEqual(fixture, before);
  assert.notEqual(validated, fixture);
  assert.ok(Object.isFrozen(validated));
  assert.ok(Object.isFrozen(validated.chapters));
});

test("flattenCases preserves order without mutating input", async () => {
  const fixture = await readFixture();
  const before = structuredClone(fixture);
  const records = flattenCases(fixture);

  assert.equal(records.length, 29);
  assert.deepEqual(fixture, before);
  assert.ok(Object.isFrozen(records));
  assert.equal(records[0].id, fixture.chapters[0].cases[0].id);
});

test("getVerdictMeta returns Chinese text and non-color status symbol", () => {
  assert.deepEqual(getVerdictMeta("partially-capable"), {
    label: "部分胜任",
    symbol: "△",
    className: "is-partial",
  });
});

test("getFeaturedCases resolves the approved feature order", async () => {
  const fixture = await readFixture();
  const featured = getFeaturedCases(fixture);

  assert.deepEqual(featured.map(({ id }) => id), fixture.featuredCaseIds);
  assert.ok(Object.isFrozen(featured));
});

test("validatePitchData rejects unsafe media schemes", async () => {
  const fixture = await readFixture();
  const unsafe = structuredClone(fixture);
  unsafe.chapters[0].cases[0].inputs[0].url = "javascript:alert(1)";

  assert.throws(() => validatePitchData(unsafe), /Unsafe media URL/);
});

test("validatePitchData rejects missing and duplicate featured records", async () => {
  const fixture = await readFixture();
  const missing = structuredClone(fixture);
  missing.featuredCaseIds = ["presenter-mens-jeans", "creative-skincare-ice", "missing-case"];
  assert.throws(() => validatePitchData(missing), /featured case/i);

  const duplicate = structuredClone(fixture);
  duplicate.featuredCaseIds = ["presenter-mens-jeans", "presenter-mens-jeans", "creative-skincare-ice"];
  assert.throws(() => validatePitchData(duplicate), /Duplicate featured/i);
});

test("validatePitchData rejects malformed required fields and dimensions", async () => {
  const fixture = await readFixture();
  const blankTitle = structuredClone(fixture);
  blankTitle.chapters[0].cases[0].title = "";
  assert.throws(() => validatePitchData(blankTitle), /title must be a non-empty string/);

  const badAspect = structuredClone(fixture);
  badAspect.chapters[0].cases[0].inputs[0].dimensions.aspectRatio = -1;
  assert.throws(() => validatePitchData(badAspect), /aspectRatio/);

  const partialDimensions = structuredClone(fixture);
  partialDimensions.chapters[0].cases[0].inputs[0].dimensions.width = 720;
  assert.throws(() => validatePitchData(partialDimensions), /dimensions must be complete/);
});

test("validatePitchData rejects chapter count and order drift", async () => {
  const fixture = await readFixture();
  const missingCase = structuredClone(fixture);
  missingCase.chapters[0].cases.pop();
  assert.throws(() => validatePitchData(missingCase), /must contain 11 cases/);

  const reordered = structuredClone(fixture);
  reordered.chapters.reverse();
  assert.throws(() => validatePitchData(reordered), /Unexpected chapter order/);
});

test("isSafeMediaUrl rejects malformed and ambiguous paths", () => {
  assert.equal(isSafeMediaUrl("https://%"), false);
  assert.equal(isSafeMediaUrl("//example.com/video.mp4"), false);
  assert.equal(isSafeMediaUrl("assets/videos/../secret.mp4"), false);
  assert.equal(isSafeMediaUrl("assets/videos/example.mp4?token=secret"), false);
  assert.equal(isSafeMediaUrl("https://example.com/video.mp4?download=1"), false);
  assert.equal(isSafeMediaUrl("https://example.com/video.mp4#preview"), false);
  assert.equal(isSafeMediaUrl("https://example.com/video.mp4"), true);
});

test("pilot selection is immutable, reversible, and rejects a fourth workflow", async () => {
  const fixture = await readFixture();
  const ids = Object.freeze(fixture.chapters.slice(0, 3).map(({ id }) => id));
  const rejected = toggleWorkflowSelection(ids, fixture.chapters[3].id);

  assert.deepEqual(rejected, { selectedIds: ids, reason: "limit-reached" });
  assert.ok(Object.isFrozen(rejected));
  assert.ok(Object.isFrozen(rejected.selectedIds));

  const deselected = toggleWorkflowSelection(ids, ids[1]);
  assert.deepEqual(deselected, {
    selectedIds: [ids[0], ids[2]],
    reason: null,
  });
  assert.deepEqual(ids, fixture.chapters.slice(0, 3).map(({ id }) => id));
});

test("pilot summary requires exactly three valid workflows in chapter order", async () => {
  const fixture = await readFixture();
  const selectedIds = [fixture.chapters[2].id, fixture.chapters[0].id, fixture.chapters[1].id];
  const safeguards = ["确认商品", "确认边界", "确认评审标准", "比较返工原因"];
  const summary = buildPilotSummary({ data: fixture, selectedIds, safeguards });

  assert.match(summary, /修订版 1214/);
  assert.match(summary, new RegExp(fixture.source.reviewedAt));
  const orderedTitles = fixture.chapters.slice(0, 3).map(({ title }) => title);
  assert.ok(summary.indexOf(orderedTitles[0]) < summary.indexOf(orderedTitles[1]));
  assert.ok(summary.indexOf(orderedTitles[1]) < summary.indexOf(orderedTitles[2]));
  assert.ok(safeguards.every((item) => summary.includes(item)));
  assert.throws(
    () => buildPilotSummary({ data: fixture, selectedIds: selectedIds.slice(0, 2), safeguards }),
    /exactly three/i,
  );
  assert.throws(
    () => buildPilotSummary({ data: fixture, selectedIds: [selectedIds[0], selectedIds[1], "missing"], safeguards }),
    /unknown workflow/i,
  );
});

test("evidence targets use globally unique composite attempt ids", async () => {
  const fixture = await readFixture();
  const chapter = fixture.chapters[0];
  const record = chapter.cases[0];
  const attempt = record.attempts[0];
  const attemptDomId = toAttemptDomId(record.id, attempt.id);

  assert.equal(attemptDomId, `${record.id}--${attempt.id}`);
  assert.deepEqual(resolveEvidenceTarget(fixture, chapter.id), {
    chapterId: chapter.id,
    caseId: null,
    attemptDomId: null,
  });
  assert.deepEqual(resolveEvidenceTarget(fixture, record.id), {
    chapterId: chapter.id,
    caseId: record.id,
    attemptDomId: null,
  });
  assert.deepEqual(resolveEvidenceTarget(fixture, attemptDomId), {
    chapterId: chapter.id,
    caseId: record.id,
    attemptDomId,
  });
  assert.equal(resolveEvidenceTarget(fixture, attempt.id), null);
  assert.equal(resolveEvidenceTarget(fixture, "missing"), null);
});

test("validatePitchData rejects unsupported nested records and top-level drift", async () => {
  const fixture = await readFixture();
  assert.throws(() => validatePitchData(null), /Pitch data must be an object/);

  const wrongSchema = structuredClone(fixture);
  wrongSchema.schemaVersion = "vips-pitch.v0";
  assert.throws(() => validatePitchData(wrongSchema), /Unsupported schemaVersion/);

  const wrongRevision = structuredClone(fixture);
  wrongRevision.source.revisionId = 1215;
  assert.throws(() => validatePitchData(wrongRevision), /Expected revision 1214/);

  const badMediaType = structuredClone(fixture);
  badMediaType.chapters[0].cases[0].inputs[0].type = "embed";
  assert.throws(() => validatePitchData(badMediaType), /type is unsupported/);

  const badSourceKind = structuredClone(fixture);
  badSourceKind.chapters[0].cases[0].inputs[0].sourceKind = "raw-token";
  assert.throws(() => validatePitchData(badSourceKind), /sourceKind is unsupported/);

  const badReview = structuredClone(fixture);
  badReview.chapters[0].cases[0].review = null;
  assert.throws(() => validatePitchData(badReview), /review must be an object/);

  assert.throws(() => getVerdictMeta("optimistic"), /Unknown verdict/);
});
