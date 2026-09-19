import { inspectLocalMedia as inspectMedia } from "../../core/media.js";
import path from "node:path";
import {
  isPresent,
  requireExactlyOne,
  validateSafeRemoteUrl,
  validationError,
} from "./common.js";

const IMAGE_EXTENSIONS = Object.freeze([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_LIMIT_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_BYTES = IMAGE_LIMIT_BYTES - 1;
const IMAGE_MAX_DIMENSION = 10_000;
const MEDIA_EXTENSIONS = Object.freeze([".mp4", ".mov", ".webm", ".mp3", ".wav", ".m4a", ".aac"]);
const VIDEO_MAX_DIMENSION = 1920;

export async function validateUpload(operation, payload, context = {}) {
  const names = operation.id === "upload.image" ? ["image", "image_url"] : ["file", "file_url"];
  const source = requireExactlyOne(operation, payload, names, names.join(" or "));
  if (source.endsWith("_url")) {
    validateSafeRemoteUrl(operation, source, payload[source]);
    return { payload, files: {} };
  }

  if (typeof payload[source] !== "string" || payload[source].trim() === "") {
    throw validationError(operation, `${source} must be a non-empty local path.`);
  }
  const inspector = context.inspectLocalMedia ?? inspectMedia;
  const allowedExtensions = operation.id === "upload.image" ? IMAGE_EXTENSIONS : MEDIA_EXTENSIONS;
  const extension = path.extname(payload[source]).toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw validationError(operation, `Unsupported local media extension: ${extension || "(none)"}.`);
  }
  const options = operation.id === "upload.image"
    ? { allowedExtensions: [...IMAGE_EXTENSIONS], maxBytes: IMAGE_MAX_BYTES }
    : { allowedExtensions: [...MEDIA_EXTENSIONS] };
  const metadata = await inspector(payload[source], options);
  if (operation.id === "upload.image") validateImageMetadata(operation, metadata);
  else validateMediaMetadata(operation, metadata);
  const rest = { ...payload };
  delete rest[source];
  return { payload: rest, files: { [source]: payload[source] } };
}

export function validateImageSource(operation, payload, names) {
  const found = names.filter((name) => isPresent(payload[name]));
  if (found.length === 0) throw validationError(operation, `${names.join(" or ")} image source is required.`);
  for (const name of found) {
    if (name.endsWith("_url")) validateSafeRemoteUrl(operation, name, payload[name]);
  }
}

function validateImageMetadata(operation, metadata) {
  if (metadata?.size_bytes >= IMAGE_LIMIT_BYTES) {
    throw validationError(operation, "Image file size must not exceed 20 MB.");
  }
  if (metadata?.width > IMAGE_MAX_DIMENSION || metadata?.height > IMAGE_MAX_DIMENSION) {
    throw validationError(operation, "Image dimensions must not exceed 10,000 pixels on either side.");
  }
}

function validateMediaMetadata(operation, metadata) {
  const hasVideo = metadata?.streams?.some(({ codec_type: type }) => type === "video")
    || metadata?.width !== undefined
    || metadata?.height !== undefined;
  if (hasVideo && (metadata?.width > VIDEO_MAX_DIMENSION || metadata?.height > VIDEO_MAX_DIMENSION)) {
    throw validationError(operation, "Uploaded video dimensions must not exceed 1,920 pixels on either side.");
  }
}
