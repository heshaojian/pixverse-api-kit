import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAssetName,
  extractMediaReferences,
  generateFeaturedPoster,
  sanitizeMp4,
  syncMedia,
  validateDownloadedMedia,
} from "../../scripts/sync-vips-pitch-media.mjs";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

test("sanitizeMp4 strips private metadata without changing the encoded streams", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vips-mp4-sanitize-"));
  const sourcePath = path.join(directory, "source.mp4");
  const destinationPath = path.join(directory, "sanitized.mp4");
  const forbiddenMetadata = "c2pa BytePlus ModelArk dreamina flog_idx log_idx certificate@example.invalid";
  try {
    await execFile("ffmpeg", [
      "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=32x24:d=1:r=10",
      "-c:v", "libx264", "-metadata", `comment=${forbiddenMetadata}`, sourcePath,
    ]);
    assert.match((await fs.readFile(sourcePath)).toString("latin1"), /BytePlus/);

    const report = await sanitizeMp4({ sourcePath, destinationPath });
    assert.deepEqual(report.before.streams, report.after.streams);
    assert.equal(report.before.duration, report.after.duration);
    assert.doesNotMatch(
      (await fs.readFile(destinationPath)).toString("latin1"),
      /c2pa|BytePlus|ModelArk|dreamina|flog_idx|log_idx|certificate@/i,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("generateFeaturedPoster extracts a metadata-free JPEG at the requested frame", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vips-featured-poster-"));
  const sourcePath = path.join(directory, "source.mp4");
  const destinationPath = path.join(directory, "poster.jpg");
  try {
    await execFile("ffmpeg", [
      "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=48x32:d=2:r=10",
      "-c:v", "libx264", "-metadata", "comment=private fixture metadata", sourcePath,
    ]);

    const entry = await generateFeaturedPoster({
      sourcePath,
      destinationPath,
      atSecond: 1,
      id: "fixture-poster",
      publicPath: "assets/images/fixture-poster.jpg",
    });

    assert.equal(entry.mimeType, "image/jpeg");
    assert.equal(entry.width, 48);
    assert.equal(entry.height, 32);
    assert.equal(entry.duration, null);
    assert.equal(entry.sourceKind, "featured-poster");
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.bytes > 0);
    assert.doesNotMatch((await fs.readFile(destinationPath)).toString("latin1"), /Lavc|private fixture metadata/i);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("featured posters are JPEGs with dimensions and verified manifest hashes", async () => {
  const pitchRoot = path.join(repoRoot, "deploy/brand-pitches/vips/human-reviewed-ecommerce");
  const manifest = JSON.parse(await fs.readFile(path.join(pitchRoot, "data/media-manifest.json"), "utf8"));
  const posterEntries = manifest.assets.filter(({ sourceKind }) => sourceKind === "featured-poster");
  assert.deepEqual(posterEntries.map(({ id }) => id), [
    "featured-presenter-poster",
    "featured-creative-poster",
    "featured-product-motion-poster",
  ]);

  for (const entry of posterEntries) {
    const filePath = path.join(pitchRoot, entry.path);
    const [{ stdout: mimeOutput }, { stdout: probeOutput }, fileBytes] = await Promise.all([
      execFile("file", ["--brief", "--mime-type", filePath], { encoding: "utf8" }),
      execFile("ffprobe", [
        "-v", "error", "-show_entries", "stream=width,height", "-of", "json", filePath,
      ], { encoding: "utf8" }),
      fs.readFile(filePath),
    ]);
    const stream = JSON.parse(probeOutput).streams[0];
    assert.equal(mimeOutput.trim(), "image/jpeg", entry.path);
    assert.equal(entry.mimeType, "image/jpeg", entry.path);
    assert.equal(entry.width, stream.width, entry.path);
    assert.equal(entry.height, stream.height, entry.path);
    assert.equal(entry.duration, null, entry.path);
    assert.equal(entry.bytes, fileBytes.length, entry.path);
    assert.equal(createHash("sha256").update(fileBytes).digest("hex"), entry.sha256, entry.path);
    assert.doesNotMatch(fileBytes.toString("latin1"), /Lavc|c2pa|jumb|BytePlus|ModelArk/i, entry.path);
  }
});

test("public MP4s exclude C2PA/JUMBF boxes and private provider metadata", async () => {
  const videoRoot = path.join(
    repoRoot,
    "deploy/brand-pitches/vips/human-reviewed-ecommerce/assets/videos",
  );
  const names = (await fs.readdir(videoRoot)).filter((name) => name.endsWith(".mp4"));
  assert.equal(names.length, 66);
  for (const name of names) {
    const binary = (await fs.readFile(path.join(videoRoot, name))).toString("latin1");
    assert.doesNotMatch(binary, /c2pa|jumb|jumd/, `${name}: provenance box`);
    assert.doesNotMatch(
      binary,
      /BytePlus|ModelArk|dreamina|flog_idx|log_idx|certificate@/i,
      `${name}: private metadata`,
    );
  }
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
