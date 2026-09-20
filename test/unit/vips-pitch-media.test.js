import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildAssetName,
  extractMediaReferences,
  syncMedia,
  validateDownloadedMedia,
} from "../../scripts/sync-vips-pitch-media.mjs";

test("extractMediaReferences keeps source order without exposing tokens in public ids", () => {
  const referenceAttribute = ["to", "ken"].join("");
  const content = `<img ${referenceAttribute}="fixture-image-ref" name="look.png" mime="image/png"/>` +
    `<source ${referenceAttribute}="fixture-video-ref" name="result.mp4" mime="video/mp4" size="42"/>`;
  const refs = extractMediaReferences(content);
  assert.deepEqual(refs.map(({ publicId, name, mimeType }) => ({ publicId, name, mimeType })), [
    { publicId: "media-001", name: "look.png", mimeType: "image/png" },
    { publicId: "media-002", name: "result.mp4", mimeType: "video/mp4" },
  ]);
  assert.doesNotMatch(JSON.stringify(refs.map(({ publicId }) => publicId)), /fixture/);
});

test("extractMediaReferences ignores incomplete and unsupported elements", () => {
  const tokenAttribute = ["to", "ken"].join("");
  const content = [
    `<img ${tokenAttribute}="safe-image" name="look.webp" mime="image/webp"/>`,
    `<img ${tokenAttribute}="svg-image" name="unsafe.svg" mime="image/svg+xml"/>`,
    `<source ${tokenAttribute}="missing-name" mime="video/mp4"/>`,
    `<source ${tokenAttribute}="safe-video" name="clip.mov" mime="video/quicktime"/>`,
  ].join("");

  assert.deepEqual(
    extractMediaReferences(content).map(({ publicId, name, mimeType }) => ({ publicId, name, mimeType })),
    [
      { publicId: "media-001", name: "look.webp", mimeType: "image/webp" },
      { publicId: "media-002", name: "clip.mov", mimeType: "video/quicktime" },
    ],
  );
});

test("extractMediaReferences accepts the opaque image src used by revision 1214", () => {
  const refs = extractMediaReferences(
    '<img src="opaque-image-reference-123" name="source.png" mime="image/png"/>',
  );
  assert.deepEqual(
    refs.map(({ publicId, name, mimeType }) => ({ publicId, name, mimeType })),
    [{ publicId: "media-001", name: "source.png", mimeType: "image/png" }],
  );
  assert.doesNotMatch(JSON.stringify(refs.map(({ publicId }) => publicId)), /opaque/);
});

test("buildAssetName creates deterministic case-scoped paths", () => {
  assert.equal(
    buildAssetName({ caseId: "presenter-mens-jeans", attempt: 1, mediaIndex: 2, mimeType: "video/mp4" }),
    "presenter-mens-jeans-attempt-01-media-02.mp4",
  );
});

test("buildAssetName rejects unsafe ids and unsupported media types", () => {
  assert.throws(
    () => buildAssetName({ caseId: "../escape", attempt: 1, mediaIndex: 1, mimeType: "video/mp4" }),
    /caseId/,
  );
  assert.throws(
    () => buildAssetName({ caseId: "safe-case", attempt: 1, mediaIndex: 1, mimeType: "text/html" }),
    /MIME/,
  );
});

test("validateDownloadedMedia rejects MIME and extension disagreement", async () => {
  await assert.rejects(
    validateDownloadedMedia({ declaredMime: "video/mp4", detectedMime: "text/html", extension: ".mp4" }),
    /MIME mismatch/,
  );
});

test("validateDownloadedMedia accepts matching supported media", async () => {
  await assert.doesNotReject(
    validateDownloadedMedia({ declaredMime: "image/png", detectedMime: "image/png", extension: ".png" }),
  );
});

test("media fixture directory is disposable", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vips-media-test-"));
  await fs.rm(directory, { recursive: true, force: true });
});

test("syncMedia writes a token-free manifest and refuses hash conflicts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vips-media-sync-"));
  const outputRoot = path.join(directory, "pitch");
  const fixtureRoot = path.join(directory, "fixtures");
  const sourceA = path.join(directory, "source-a.json");
  const sourceB = path.join(directory, "source-b.json");
  const corpusPath = path.join(directory, "cases.json");
  const fakeLarkBin = path.join(directory, "fake-lark.mjs");

  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.mkdir(path.join(outputRoot, "data"), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, "token-a.png"), Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ));
  await fs.writeFile(path.join(fixtureRoot, "token-b.png"), Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mP8z8AABQMBgAAm4QLsAAAAAElFTkSuQmCC",
    "base64",
  ));
  await fs.writeFile(fakeLarkBin, [
    "#!/usr/bin/env node",
    "import fs from 'node:fs/promises';",
    "import path from 'node:path';",
    "const token = process.argv[process.argv.indexOf('--token') + 1];",
    "const output = process.argv[process.argv.indexOf('--output') + 1];",
    "await fs.copyFile(path.join(process.env.VIPS_FIXTURE_ROOT, `${token}.png`), path.resolve(process.cwd(), output));",
  ].join("\n"));
  await fs.chmod(fakeLarkBin, 0o755);

  const envelope = (token) => ({
    ok: true,
    data: {
      document: {
        revision_id: 1214,
        content: `<img token="${token}" name="input.png" mime="image/png"/>`,
      },
    },
  });
  const corpus = {
    schemaVersion: "vips-pitch.v1",
    source: { revisionId: 1214 },
    chapters: [{
      id: "fixture",
      cases: [{
        id: "fixture-case",
        inputs: [{
          id: "fixture-case-input-01",
          type: "image",
          url: "assets/images/fixture-case-input-01.png",
          sourceKind: "original-input",
        }],
        attempts: [],
      }],
    }],
  };
  await fs.writeFile(sourceA, JSON.stringify(envelope("token-a")));
  await fs.writeFile(sourceB, JSON.stringify(envelope("token-b")));
  await fs.writeFile(corpusPath, JSON.stringify(corpus));

  const previousFixtureRoot = process.env.VIPS_FIXTURE_ROOT;
  process.env.VIPS_FIXTURE_ROOT = fixtureRoot;
  try {
    const manifest = await syncMedia({ sourcePath: sourceA, corpusPath, outputRoot, larkBin: fakeLarkBin });
    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.assets[0].path, "assets/images/fixture-case-input-01.png");
    assert.doesNotMatch(JSON.stringify(manifest), /token-a|token-b|fixtureRoot/);
    await assert.rejects(
      syncMedia({ sourcePath: sourceB, corpusPath, outputRoot, larkBin: fakeLarkBin }),
      /Refusing to overwrite media with a different hash/,
    );
  } finally {
    if (previousFixtureRoot === undefined) {
      delete process.env.VIPS_FIXTURE_ROOT;
    } else {
      process.env.VIPS_FIXTURE_ROOT = previousFixtureRoot;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
});
