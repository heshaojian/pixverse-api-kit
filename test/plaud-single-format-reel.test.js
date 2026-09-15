import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCreatePayload } from "../src/client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDirectory = path.join(root, "payloads/plaud-single-format-reel");
const manifestPath = path.join(payloadDirectory, "manifest.json");

const expectedFormats = [
  {
    id: "pdp-motion",
    title: "PDP Motion",
    pacing: /\b(?:calm|measured|slow|steady|unhurried)\b/i,
    context: /\b(?:inspect(?:ion)?|product detail|tabletop|desk|neutral (?:set|surface)|product truth)\b/i,
  },
  {
    id: "tiktok-shop-ad",
    title: "TikTok Shop Ad",
    pacing: /\b(?:fast|rapid|quick|brisk|punchy|hard cuts?|thumb[- ]stopping)\b/i,
    context: /\b(?:shop|scroll|hook|collar|button tap|use moment)\b/i,
  },
  {
    id: "creator-wear-use",
    title: "Creator Wear & Use",
    pacing: /\b(?:natural|observational|casual|social|creator[- ]style|lived[- ]in)\b/i,
    context: /\b(?:creator|wear(?:able|ing)?|jacket|collar|day[- ]in[- ]the[- ]life|commute|meeting)\b/i,
  },
];

const expectedFormatIds = expectedFormats.map(({ id }) => id);
const expectedFormatsMetadata = expectedFormatIds.join(",");
const creativeInstructionPattern =
  /\b(?:create|generate|animate|film|video|shot|scene|camera|pacing|hook|cut|chapter|voiceover|captions?|subtitles?|avatar|prompt)\b|creative (?:direction|brief)|lip[- ]sync/i;
const softwareFramingPattern =
  /\b(?:AI|artificial intelligence|apps?|software|transcripts?|summari[sz]ation)\b/i;
const prohibitionPattern = /\b(?:no|without|never|avoid|exclude|do not|must not)\b/i;

function assertExplicitlyProhibits(creativeDirection, conceptPattern, label) {
  const prohibitionClauses = creativeDirection
    .split(/[.;]/)
    .filter((clause) => prohibitionPattern.test(clause));

  assert.ok(
    prohibitionClauses.some((clause) => conceptPattern.test(clause)),
    `creative direction must explicitly prohibit ${label}`,
  );
}

function getOrderedChapterSections(creativeDirection) {
  const normalizedDirection = creativeDirection.toLowerCase();
  const chapterStarts = expectedFormats.map(({ title }) => normalizedDirection.indexOf(title.toLowerCase()));

  assert.ok(chapterStarts.every((index) => index >= 0), "creative direction must name all three format chapters");
  assert.deepEqual([...chapterStarts].sort((left, right) => left - right), chapterStarts, "format chapters must be ordered");

  return chapterStarts.map((start, index) => {
    const end = chapterStarts[index + 1] ?? creativeDirection.length;
    return creativeDirection.slice(start, end);
  });
}

test("Plaud single-format reel combines three honest formats in one controlled payload", async (t) => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  await t.test("manifest contains exactly one NotePin S combined-reel record", () => {
    assert.ok(Array.isArray(manifest.records));
    assert.equal(manifest.records.length, 1);

    const [record] = manifest.records;
    assert.equal(record.lane, "single-format-reel");
    assert.equal(record.product_id, "plaud-notepin-s");
    assert.deepEqual(record.formats, expectedFormatIds);
    assert.match(record.payload, /^payloads\/plaud-single-format-reel\/[^/]+\.json$/);
    assert.equal(record.qa_status, "passed");
    assert.equal(
      record.deliverable_path,
      "projects/plaud-single-format-reel/deliverables/plaud-notepin-s-three-format-reel-30s.mp4",
    );
    assert.equal(
      record.pitch_video_path,
      "pilot/plaud-growth-studio-pitch/assets/plaud-notepin-s-three-format-reel-30s.mp4",
    );
    assert.equal(Object.hasOwn(record, "video_url"), false, "the untrimmed provider asset must not be labeled final");
  });

  const [record] = manifest.records;
  const payload = JSON.parse(await fs.readFile(path.join(root, record.payload), "utf8"));
  const productDescription = payload.product.description;
  const creativeDirection = payload.video.creative_ad_clone;

  await t.test("payload uses the approved silent 30-second vertical hardware setup", () => {
    validateCreatePayload(payload);
    assert.equal(payload.product.title, "Plaud NotePin S");
    assert.equal(payload.video.duration_seconds, 30);
    assert.equal(payload.video.aspect_ratio, "9:16");
    assert.equal(payload.video.resolution, "1080p");
    assert.equal(payload.video.voiceover, false);
    assert.equal(payload.video.captions, false);
  });

  await t.test("product truth and creative direction stay in their proper fields", () => {
    assert.equal(typeof productDescription, "string");
    assert.ok(productDescription.length >= 80);
    assert.doesNotMatch(productDescription, creativeInstructionPattern);
    assert.doesNotMatch(productDescription, softwareFramingPattern);

    assert.equal(typeof creativeDirection, "string");
    assert.ok(creativeDirection.length >= 500);
    assert.equal(payload.metadata.product_description_source, payload.product.source_url);
    assert.equal(payload.metadata.lane, "single-format-reel");
    assert.equal(payload.metadata.formats, expectedFormatsMetadata);
    assert.equal(Object.hasOwn(payload.metadata, "creative_brief"), false);
  });

  await t.test("three chapters are ordered and visibly different in pacing and context", () => {
    const chapterSections = getOrderedChapterSections(creativeDirection);

    for (const [index, expectation] of expectedFormats.entries()) {
      const chapter = chapterSections[index];
      assert.ok(chapter.length >= 80, `${expectation.title} needs substantive direction`);
      assert.match(chapter, expectation.pacing, `${expectation.title} needs its own pacing`);
      assert.match(chapter, expectation.context, `${expectation.title} needs its own context`);
    }

    assert.equal(new Set(chapterSections).size, expectedFormats.length);
  });

  await t.test("text is scoped to the shop chapter and shared safety bans are explicit", () => {
    const [, tiktokChapter] = getOrderedChapterSections(creativeDirection);

    assert.match(
      creativeDirection,
      /\b(?:on[- ]screen|overlay) text\b[^.]{0,180}\bonly\b[^.]{0,180}\bTikTok Shop Ad\b/i,
      "on-screen text must be limited to the TikTok Shop Ad chapter",
    );
    assert.match(
      creativeDirection,
      /\b(?:PDP Motion|Creator Wear & Use)\b[^.]{0,180}\b(?:no|without)\b[^.]{0,100}\b(?:on[- ]screen|overlay) text\b/i,
      "non-shop chapters must explicitly stay text-free",
    );
    assert.match(
      tiktokChapter,
      /\bmust read exactly\s*[“\"]CLIP\. TAP\. GO\.[”\"]/i,
      "TikTok Shop Ad must limit its overlay to the approved copy",
    );
    assert.deepEqual(
      [...tiktokChapter.matchAll(/[“\"]([^”\"]+)[”\"]/g)].map((match) => match[1]),
      ["CLIP. TAP. GO."],
      "TikTok Shop Ad must not contain additional quoted overlay copy",
    );
    assertExplicitlyProhibits(tiktokChapter, /\bprices?\b/i, "price messaging");
    assertExplicitlyProhibits(tiktokChapter, /\bpromotions?\b/i, "promotional messaging");
    assertExplicitlyProhibits(tiktokChapter, /\burgency\b/i, "urgency messaging");

    assertExplicitlyProhibits(creativeDirection, /\bapps?\b/i, "app screens");
    assertExplicitlyProhibits(creativeDirection, /\bsoftware\b/i, "software UI");
    assertExplicitlyProhibits(creativeDirection, /\btranscripts?\b/i, "transcript overlays");
    assertExplicitlyProhibits(creativeDirection, /\b(?:AI|artificial intelligence)\b/i, "AI framing");
    assertExplicitlyProhibits(
      creativeDirection,
      /\b(?:talking|speaking|presenters?|talking heads?)\b/i,
      "talking or speaking presenters",
    );
    assertExplicitlyProhibits(creativeDirection, /\b(?:narration|voiceover)\b/i, "narration");
    assertExplicitlyProhibits(creativeDirection, /\blip(?: |-)?(?:movement|sync(?:ing)?)\b/i, "lip movement");
    assertExplicitlyProhibits(creativeDirection, /\b(?:invented|unsupported|unverified) claims?\b/i, "invented claims");
    assertExplicitlyProhibits(creativeDirection, /\baccessor(?:y|ies)\b/i, "invented accessories");
    assertExplicitlyProhibits(creativeDirection, /\blogos?\b/i, "invented logos");
    assertExplicitlyProhibits(creativeDirection, /\bfeatures?\b/i, "invented features");
    assertExplicitlyProhibits(creativeDirection, /\bmorph(?:ing)?\b/i, "product morphing");
    assertExplicitlyProhibits(creativeDirection, /\bfloating\b/i, "floating products or graphics");
  });
});
