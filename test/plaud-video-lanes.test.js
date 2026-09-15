import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateCreatePayload } from "../src/client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDirectory = path.join(root, "payloads/plaud-video-lanes");
const manifestPath = path.join(payloadDirectory, "manifest.json");

const expectedLanes = {
  "pdp-motion": {
    productId: "plaud-note-pro",
    productTitle: "Plaud Note Pro",
    direction: /\b(?:PDP|product detail page|inspection|product truth)\b/i,
    pacing: /\b(?:calm|measured|unhurried|continuous|slow)\b/i,
    context: /\b(?:desk|tabletop|neutral (?:set|surface)|product page)\b/i,
  },
  "performance-ads": {
    productId: "plaud-notepin-s",
    productTitle: "Plaud NotePin S",
    direction: /\b(?:performance ad|thumb[- ]stopping|paid social|hook)\b/i,
    pacing: /\b(?:fast|rapid|brisk|punchy|quick|hard cuts?|high[- ]energy)\b/i,
    context: /\b(?:use moment|meeting|commute|jacket|collar|on[- ]the[- ]go|wearable)\b/i,
  },
  "launch-film": {
    productId: "plaud-one",
    productTitle: "Plaud One",
    direction: /\b(?:launch film|studio reveal|hero reveal|hardware desire)\b/i,
    pacing: /\b(?:cinematic|build|deliberate|restrained|slow reveal|light sweep)\b/i,
    context: /\b(?:dark studio|studio reveal|pedestal|hero stage|black stage|light sweep)\b/i,
  },
};

const generationInstructionPattern =
  /\b(?:create|generate|animate|film|video|shot|scene|camera|pacing|hook|cut|reveal|voiceover|captions?|subtitles?|avatar|prompt)\b|creative (?:direction|brief)|lip[- ]sync/i;
const softwareFramingPattern =
  /\b(?:AI|artificial intelligence|apps?|software|transcripts?|summari[sz]ation)\b/i;
const prohibitionPattern = /\b(?:no|without|never|avoid|exclude|do not|must not)\b/i;

function assertExplicitlyProhibits(creativeDirection, conceptPattern, label) {
  const prohibitionClauses = creativeDirection.split(/[.;]/).filter((clause) => prohibitionPattern.test(clause));

  assert.ok(
    prohibitionClauses.some((clause) => conceptPattern.test(clause)),
    `creative direction must explicitly prohibit ${label}`,
  );
}

test("Plaud video lanes keep product truth separate and make all three formats distinct", async (t) => {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const records = manifest.records;

  await t.test("manifest contains exactly the three approved lane-to-product pairings", () => {
    assert.ok(Array.isArray(records));
    assert.equal(records.length, 3);
    assert.deepEqual(
      new Set(records.map(({ lane }) => lane)),
      new Set(Object.keys(expectedLanes)),
    );

    for (const record of records) {
      const expectation = expectedLanes[record.lane];

      assert.equal(record.product_id, expectation.productId);
      assert.match(record.payload, /^payloads\/plaud-video-lanes\/[^/]+\.json$/);
    }
  });

  const payloadsByLane = new Map();
  for (const record of records) {
    const payload = JSON.parse(await fs.readFile(path.join(root, record.payload), "utf8"));
    payloadsByLane.set(record.lane, payload);
  }

  await t.test("every payload is API-valid, hardware-only, silent, and factually sourced", () => {
    for (const record of records) {
      const payload = payloadsByLane.get(record.lane);
      const expectation = expectedLanes[record.lane];
      const productDescription = payload.product.description;
      const creativeDirection = payload.video.creative_ad_clone;

      validateCreatePayload(payload);
      assert.equal(payload.product.title, expectation.productTitle);
      assert.equal(typeof productDescription, "string");
      assert.ok(productDescription.length >= 80);
      assert.doesNotMatch(productDescription, generationInstructionPattern);
      assert.doesNotMatch(productDescription, softwareFramingPattern);

      assert.equal(payload.metadata.product_description_source, payload.product.source_url);
      assert.equal(payload.metadata.lane, record.lane);
      assert.equal(Object.hasOwn(payload.metadata, "creative_brief"), false);

      assert.equal(payload.video.voiceover, false);
      assert.equal(payload.video.captions, false);
      assert.equal(payload.video.avatar.mode, "auto");
      assert.match(creativeDirection, /\bhardware[- ]only\b/i);
      assertExplicitlyProhibits(creativeDirection, /\bapps?\b/i, "app screens");
      assertExplicitlyProhibits(creativeDirection, /\bsoftware\b/i, "software UI");
      assertExplicitlyProhibits(creativeDirection, /\btranscripts?\b/i, "transcript overlays");
      assertExplicitlyProhibits(creativeDirection, /\b(?:talking|speaking|presenters?)\b/i, "talking heads");
      assertExplicitlyProhibits(
        creativeDirection,
        /\blip(?: |-)?(?:movement|sync(?:ing)?)\b/i,
        "lip movement",
      );
      assertExplicitlyProhibits(
        creativeDirection,
        /\b(?:invented|unsupported|unverified) claims?\b/i,
        "invented claims",
      );
    }
  });

  await t.test("creative direction, pacing, and setting are visibly lane-specific", () => {
    const creativeDirections = [];

    for (const [lane, expectation] of Object.entries(expectedLanes)) {
      const creativeDirection = payloadsByLane.get(lane).video.creative_ad_clone;

      creativeDirections.push(creativeDirection);
      assert.match(creativeDirection, expectation.direction, `${lane} needs its format-specific direction`);
      assert.match(creativeDirection, expectation.pacing, `${lane} needs its own pacing`);
      assert.match(creativeDirection, expectation.context, `${lane} needs its own context`);
    }

    assert.equal(new Set(creativeDirections).size, 3);
  });
});
