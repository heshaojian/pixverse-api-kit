#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

const MIME_EXTENSIONS = Object.freeze({
  "image/jpeg": Object.freeze([".jpg", ".jpeg"]),
  "image/png": Object.freeze([".png"]),
  "image/webp": Object.freeze([".webp"]),
  "video/mp4": Object.freeze([".mp4"]),
  "video/quicktime": Object.freeze([".mov"]),
});

const FEATURE_ALIASES = Object.freeze([
  Object.freeze({
    caseId: "presenter-mens-jeans",
    sourceName: "男式牛仔裤_GrowthStudio_Agent_无声.mp4",
    id: "featured-presenter",
    path: "assets/videos/featured-presenter.mp4",
    poster: Object.freeze({
      id: "featured-presenter-poster",
      path: "assets/images/featured-presenter-poster.jpg",
      atSecond: 4,
    }),
  }),
  Object.freeze({
    caseId: "creative-skincare-ice",
    sourceName: "PixVerseAgent_720P_FOR.mp4",
    id: "featured-creative",
    path: "assets/videos/featured-creative.mp4",
    poster: Object.freeze({
      id: "featured-creative-poster",
      path: "assets/images/featured-creative-poster.jpg",
      atSecond: 1,
    }),
  }),
  Object.freeze({
    caseId: "product-motion-multi-pose",
    sourceName: "06.mp4",
    id: "featured-product-motion",
    path: "assets/videos/featured-product-motion.mp4",
    poster: Object.freeze({
      id: "featured-product-motion-poster",
      path: "assets/images/featured-product-motion-poster.jpg",
      atSecond: 4,
    }),
  }),
]);

const decodeXml = (value) => value
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&amp;", "&");

const parseAttributes = (source) => Object.freeze(Object.fromEntries(
  [...source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1], decodeXml(match[2] ?? match[3] ?? "")]),
));

const mediaExtension = (mimeType) => {
  const extensions = MIME_EXTENSIONS[mimeType];
  if (!extensions) throw new Error(`Unsupported MIME type: ${mimeType}`);
  return extensions[0];
};

const assertSafeInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 999) {
    throw new Error(`${label} must be an integer from 1 to 999`);
  }
};

const assertPublicPath = (value) => {
  if (typeof value !== "string" || path.isAbsolute(value) || value.includes("\\")) {
    throw new Error(`Unsafe public media path: ${value}`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith("../") || !/^assets\/(?:images|videos)\/[a-z0-9][a-z0-9.-]*$/.test(value)) {
    throw new Error(`Unsafe public media path: ${value}`);
  }
  return value;
};

export function extractMediaReferences(xmlContent) {
  if (typeof xmlContent !== "string") throw new TypeError("xmlContent must be a string");
  const references = [];
  for (const match of xmlContent.matchAll(/<(img|source)\b([^>]*)\/?\s*>/gi)) {
    const attributes = parseAttributes(match[2]);
    const legacyImageReference = match[1].toLowerCase() === "img" && /^[A-Za-z0-9_-]{20,128}$/.test(attributes.src ?? "")
      ? attributes.src
      : null;
    const sourceReference = attributes.token ?? legacyImageReference;
    if (!sourceReference || !attributes.name || !MIME_EXTENSIONS[attributes.mime]) continue;
    references.push(Object.freeze({
      publicId: `media-${String(references.length + 1).padStart(3, "0")}`,
      name: attributes.name,
      mimeType: attributes.mime,
      token: sourceReference,
    }));
  }
  return Object.freeze(references);
}

export function buildAssetName({ caseId, attempt, mediaIndex, mimeType }) {
  if (typeof caseId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(caseId)) {
    throw new Error("caseId must be a lowercase kebab-case identifier");
  }
  assertSafeInteger(attempt, "attempt");
  assertSafeInteger(mediaIndex, "mediaIndex");
  return `${caseId}-attempt-${String(attempt).padStart(2, "0")}-media-${String(mediaIndex).padStart(2, "0")}${mediaExtension(mimeType)}`;
}

export async function validateDownloadedMedia({ declaredMime, detectedMime, extension }) {
  const allowedExtensions = MIME_EXTENSIONS[declaredMime];
  if (!allowedExtensions) throw new Error(`Unsupported declared MIME type: ${declaredMime}`);
  if (detectedMime !== declaredMime) {
    throw new Error(`MIME mismatch: declared ${declaredMime}, detected ${detectedMime}`);
  }
  if (!allowedExtensions.includes(String(extension).toLowerCase())) {
    throw new Error(`MIME mismatch: ${declaredMime} cannot use ${extension}`);
  }
  return true;
}

const localCorpusMedia = (corpus) => Object.freeze(corpus.chapters.flatMap((chapter) =>
  chapter.cases.flatMap((record) => {
    const inputs = record.inputs
      .filter(({ url }) => typeof url === "string" && !/^https:/i.test(url))
      .map((media, index) => Object.freeze({
        chapterId: chapter.id,
        caseId: record.id,
        attempt: null,
        mediaIndex: index + 1,
        media,
      }));
    const attempts = record.attempts.flatMap((attemptRecord, attemptIndex) =>
      attemptRecord.media.map((media, mediaIndex) => Object.freeze({
        chapterId: chapter.id,
        caseId: record.id,
        attempt: attemptIndex + 1,
        mediaIndex: mediaIndex + 1,
        media,
      })));
    return [...inputs, ...attempts];
  })
));

const sha256File = async (filePath) => createHash("sha256")
  .update(await fs.readFile(filePath))
  .digest("hex");

const inspectFile = async (filePath) => {
  const [{ stdout: mimeOutput }, stats] = await Promise.all([
    execFile("file", ["--brief", "--mime-type", filePath], { encoding: "utf8" }),
    fs.stat(filePath),
  ]);
  return Object.freeze({ detectedMime: mimeOutput.trim(), bytes: stats.size });
};

const probeMedia = async (filePath) => {
  const { stdout } = await execFile("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,width,height",
    "-of", "json",
    filePath,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  const visualStream = (parsed.streams ?? []).find(({ width, height }) => width && height) ?? {};
  const durationValue = Number(parsed.format?.duration);
  return Object.freeze({
    width: visualStream.width ?? null,
    height: visualStream.height ?? null,
    duration: Number.isFinite(durationValue) ? durationValue : null,
  });
};

const hasForbiddenBinaryMetadata = (value) =>
  /c2pa|jumb|jumd/.test(value) || /BytePlus|ModelArk|dreamina|flog_idx|log_idx|certificate@/i.test(value);

const probeStreams = async (filePath) => {
  const { stdout } = await execFile("ffprobe", [
    "-v", "error", "-show_entries",
    "format=duration:stream=index,codec_type,codec_name,width,height,sample_rate,channels",
    "-of", "json", filePath,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  return Object.freeze({
    duration: Number(parsed.format?.duration),
    streams: Object.freeze((parsed.streams ?? [])
      .filter(({ codec_type: type }) => type === "video" || type === "audio")
      .map(({ index, codec_type: type, codec_name: codec, width, height, sample_rate: sampleRate, channels }) =>
        Object.freeze({ index, type, codec, width: width ?? null, height: height ?? null, sampleRate: sampleRate ?? null, channels: channels ?? null })
      )),
  });
};

export async function sanitizeMp4({ sourcePath, destinationPath }) {
  if (path.resolve(sourcePath) === path.resolve(destinationPath)) throw new Error("MP4 sanitation requires a distinct destination");
  const before = await probeStreams(sourcePath);
  const seiFilter = before.streams.find(({ type }) => type === "video")?.codec === "h264" ? "filter_units=remove_types=6" : null;
  if (!seiFilter) throw new Error("MP4 sanitation supports H.264 video only");
  await execFile("ffmpeg", [
    "-y", "-v", "error", "-i", sourcePath,
    "-map", "0:v?", "-map", "0:a?", "-map_metadata", "-1", "-map_chapters", "-1",
    "-metadata", "title=", "-metadata", "comment=", "-metadata", "encoder=",
    "-metadata:s:v", "encoder=", "-metadata:s:a", "encoder=",
    "-c", "copy", "-bsf:v", seiFilter, "-movflags", "+faststart", destinationPath,
  ], { maxBuffer: 8 * 1024 * 1024 });
  const after = await probeStreams(destinationPath);
  if (JSON.stringify(before.streams) !== JSON.stringify(after.streams)) throw new Error("MP4 sanitation changed A/V streams");
  if (!Number.isFinite(before.duration) || !Number.isFinite(after.duration) || Math.abs(before.duration - after.duration) > 0.001) {
    throw new Error("MP4 sanitation changed duration");
  }
  if (hasForbiddenBinaryMetadata((await fs.readFile(destinationPath)).toString("latin1"))) {
    throw new Error("Sanitized MP4 still contains forbidden metadata");
  }
  return Object.freeze({ before, after });
}

const writeWithoutConflict = async ({ stagingPath, destinationPath, incomingHash }) => {
  try {
    const currentHash = await sha256File(destinationPath);
    if (currentHash !== incomingHash) {
      throw new Error(`Refusing to overwrite media with a different hash: ${destinationPath}`);
    }
    await fs.rm(stagingPath, { force: true });
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.rename(stagingPath, destinationPath);
};

const publicManifestEntry = ({ id, publicPath, mimeType, bytes, sha256, probe, sourceKind }) => Object.freeze({
  id,
  path: publicPath,
  mimeType,
  bytes,
  sha256,
  width: probe.width,
  height: probe.height,
  duration: probe.duration,
  sourceKind,
});

export async function generateFeaturedPoster({ sourcePath, destinationPath, atSecond, id, publicPath }) {
  if (path.resolve(sourcePath) === path.resolve(destinationPath)) {
    throw new Error("Poster extraction requires a distinct destination");
  }
  if (!Number.isFinite(atSecond) || atSecond < 0) throw new Error("Poster timestamp must be non-negative");
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*-poster$/.test(id)) {
    throw new Error("Poster id must be a safe featured-poster identifier");
  }
  const safePublicPath = assertPublicPath(publicPath);
  if (path.posix.extname(safePublicPath) !== ".jpg") throw new Error("Featured posters must use .jpg");

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await execFile("ffmpeg", [
    "-y", "-v", "error", "-i", sourcePath, "-ss", String(atSecond),
    "-frames:v", "1", "-an", "-map_metadata", "-1", "-map_chapters", "-1",
    "-metadata", "title=", "-metadata", "comment=", "-metadata", "encoder=",
    "-fflags", "+bitexact", "-flags:v", "+bitexact",
    "-q:v", "2", "-pix_fmt", "yuvj420p", destinationPath,
  ], { maxBuffer: 8 * 1024 * 1024 });

  const [{ detectedMime, bytes }, sha256, probe, binary] = await Promise.all([
    inspectFile(destinationPath),
    sha256File(destinationPath),
    probeMedia(destinationPath),
    fs.readFile(destinationPath),
  ]);
  await validateDownloadedMedia({ declaredMime: "image/jpeg", detectedMime, extension: ".jpg" });
  if (!Number.isSafeInteger(probe.width) || !Number.isSafeInteger(probe.height)) {
    throw new Error("Featured poster has invalid dimensions");
  }
  if (hasForbiddenBinaryMetadata(binary.toString("latin1"))) {
    throw new Error("Featured poster contains forbidden metadata");
  }
  return publicManifestEntry({
    id,
    publicPath: safePublicPath,
    mimeType: detectedMime,
    bytes,
    sha256,
    probe: Object.freeze({ width: probe.width, height: probe.height, duration: null }),
    sourceKind: "featured-poster",
  });
}

const copyAlias = async ({ outputRoot, alias, sourcePath, entry }) => {
  const destination = path.join(outputRoot, alias.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    const currentHash = await sha256File(destination);
    if (currentHash !== entry.sha256) throw new Error(`Refusing to overwrite alias with a different hash: ${destination}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.copyFile(sourcePath, destination);
  }
  return publicManifestEntry({
    id: alias.id,
    publicPath: alias.path,
    mimeType: entry.mimeType,
    bytes: entry.bytes,
    sha256: entry.sha256,
    probe: Object.freeze({ width: entry.width, height: entry.height, duration: entry.duration }),
    sourceKind: "featured-alias",
  });
};

export async function syncMedia({ sourcePath, corpusPath, outputRoot, larkBin = "lark-cli" }) {
  const [sourceEnvelope, corpus] = await Promise.all([
    fs.readFile(sourcePath, "utf8").then(JSON.parse),
    fs.readFile(corpusPath, "utf8").then(JSON.parse),
  ]);
  const document = sourceEnvelope?.data?.document;
  if (sourceEnvelope?.ok !== true || document?.revision_id !== 1214) {
    throw new Error("Expected a successful Lark fetch response for revision 1214");
  }
  if (corpus?.schemaVersion !== "vips-pitch.v1" || corpus?.source?.revisionId !== 1214) {
    throw new Error("Expected the revision-1214 VIPS corpus");
  }

  const references = extractMediaReferences(document.content);
  const targets = localCorpusMedia(corpus);
  if (references.length !== targets.length) {
    throw new Error(`Media reconciliation mismatch: source=${references.length}, corpus=${targets.length}`);
  }

  const stagingRoot = path.join(outputRoot, ".vips-media-staging");
  await fs.mkdir(stagingRoot, { recursive: true });
  const entries = [];
  try {
    for (let index = 0; index < references.length; index += 1) {
      const reference = references[index];
      const target = targets[index];
      const publicPath = assertPublicPath(target.media.url);
      const expectedExtension = path.extname(publicPath).toLowerCase();
      await validateDownloadedMedia({
        declaredMime: reference.mimeType,
        detectedMime: reference.mimeType,
        extension: expectedExtension,
      });

      if (target.attempt !== null) {
        const expectedName = buildAssetName({
          caseId: target.caseId,
          attempt: target.attempt,
          mediaIndex: target.mediaIndex,
          mimeType: reference.mimeType,
        });
        if (path.posix.basename(publicPath) !== expectedName) {
          throw new Error(`Corpus path does not match deterministic name: ${publicPath}`);
        }
      }

      const stagingName = `${reference.publicId}${expectedExtension}`;
      const downloadPath = path.join(stagingRoot, `download-${stagingName}`);
      await fs.rm(downloadPath, { force: true });
      await execFile(larkBin, [
        "docs", "+media-download",
        "--token", reference.token,
        "--output", path.relative(outputRoot, downloadPath),
        "--as", "user",
        "--format", "json",
      ], {
        cwd: outputRoot,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
          LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
        },
      });

      const stagingPath = reference.mimeType === "video/mp4"
        ? path.join(stagingRoot, stagingName)
        : downloadPath;
      if (reference.mimeType === "video/mp4") {
        await fs.rm(stagingPath, { force: true });
        await sanitizeMp4({ sourcePath: downloadPath, destinationPath: stagingPath });
        await fs.rm(downloadPath, { force: true });
      }
      const { detectedMime, bytes } = await inspectFile(stagingPath);
      await validateDownloadedMedia({
        declaredMime: reference.mimeType,
        detectedMime,
        extension: expectedExtension,
      });
      const [sha256, probe] = await Promise.all([sha256File(stagingPath), probeMedia(stagingPath)]);
      const destinationPath = path.join(outputRoot, publicPath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await writeWithoutConflict({ stagingPath, destinationPath, incomingHash: sha256 });

      const entry = publicManifestEntry({
        id: target.media.id,
        publicPath,
        mimeType: detectedMime,
        bytes,
        sha256,
        probe,
        sourceKind: target.media.sourceKind,
      });
      entries.push(entry);

      const alias = FEATURE_ALIASES.find((candidate) =>
        candidate.caseId === target.caseId && candidate.sourceName === reference.name
      );
      if (alias) {
        entries.push(await copyAlias({ outputRoot, alias, sourcePath: destinationPath, entry }));
        const posterDestination = path.join(outputRoot, alias.poster.path);
        entries.push(await generateFeaturedPoster({
          sourcePath: path.join(outputRoot, alias.path),
          destinationPath: posterDestination,
          atSecond: alias.poster.atSecond,
          id: alias.poster.id,
          publicPath: alias.poster.path,
        }));
      }
    }
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }

  const manifest = Object.freeze({
    schemaVersion: "vips-media.v1",
    sourceRevisionId: 1214,
    assets: Object.freeze(entries),
  });
  const manifestPath = path.join(outputRoot, "data/media-manifest.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o644 });
  return manifest;
}

const parseCliArgs = (argv) => Object.fromEntries(argv.flatMap((value, index) =>
  value.startsWith("--") && argv[index + 1] ? [[value.slice(2), argv[index + 1]]] : []
));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.source || !args.corpus || !args.output) {
    console.error("Usage: sync-vips-pitch-media.mjs --source <fetch.json> --corpus <cases.json> --output <pitch-root>");
    process.exitCode = 2;
  } else {
    syncMedia({
      sourcePath: path.resolve(args.source),
      corpusPath: path.resolve(args.corpus),
      outputRoot: path.resolve(args.output),
      larkBin: args["lark-bin"] ?? "lark-cli",
    }).then((manifest) => {
      console.log(JSON.stringify({ ok: true, assets: manifest.assets.length }));
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
