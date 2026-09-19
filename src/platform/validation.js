import {
  cloneInput,
  normalizeIdentifier,
  normalizeIdentifierFields,
  validateKnownUrls,
  validationError,
} from "./validators/common.js";
import { validateUpload } from "./validators/media.js";
import { validateSpecializedOperation } from "./validators/specialized.js";
import { validateVideoOperation } from "./validators/video.js";

const VIDEO_POLICIES = new Set([
  "video.text", "video.image", "video.template", "video.transition",
  "video.multi-transition", "video.lip-sync", "video.fusion", "video.avatar",
]);
const PATH_PARAMETER = /\{([^}]+)\}/g;
const QUERY_FIELDS = Object.freeze({
  "resource.templates": ["type", "page", "pageSize", "template_ids"],
  "resource.tts-speakers": ["page_num", "page_size", "speaker_type"],
  "resource.restyle-effects": ["page_num", "page_size"],
});

export async function normalizeAndValidatePlatformInput(operation, input, context = {}) {
  validateOperation(operation);
  const cloned = normalizeIdentifierFields(operation, cloneInput(operation, input));
  const { payload, query, pathParams, files } = splitInput(operation, cloned);
  extractPathParams(operation, payload, pathParams);
  extractQueryParams(operation, payload, query);
  validateKnownUrls(operation, { payload, query, pathParams });

  let normalizedPayload = payload;
  let normalizedFiles = files;
  if (operation.validationPolicy === "upload.image" || operation.validationPolicy === "upload.media") {
    const upload = await validateUpload(operation, { ...payload, ...files }, context);
    normalizedPayload = upload.payload;
    normalizedFiles = upload.files;
  } else if (VIDEO_POLICIES.has(operation.validationPolicy)) {
    validateVideoOperation(operation, payload);
  } else if (operation.validationPolicy === "voice.delete"
    || operation.validationPolicy === "image.status"
    || operation.validationPolicy === "video.status") {
    // Path extraction above is the complete validation for status/delete lookups.
  } else {
    await validateSpecializedOperation(operation, payload, query, context);
  }

  return {
    payload: normalizedPayload,
    query,
    pathParams,
    files: normalizedFiles,
    validationSummary: {
      operation: operation.id,
      policy: operation.validationPolicy,
      inspected_media: Object.keys(normalizedFiles).length > 0,
    },
  };
}

function validateOperation(operation) {
  if (!operation || typeof operation !== "object" || typeof operation.id !== "string") {
    throw validationError(operation, "A cataloged Platform operation is required.");
  }
  if (typeof operation.validationPolicy !== "string" || operation.validationPolicy === "") {
    throw validationError(operation, `Operation ${operation.id} has no validation policy.`);
  }
}

function splitInput(operation, input) {
  const hasEnvelope = ["payload", "query", "pathParams", "files"].some((key) => Object.hasOwn(input, key));
  if (!hasEnvelope) return { payload: input, query: {}, pathParams: {}, files: {} };
  const { payload = {}, query = {}, pathParams = {}, files = {}, ...unknown } = input;
  return {
    payload: { ...unknown, ...ensureObject(operation, payload, "payload") },
    query: ensureObject(operation, query, "query"),
    pathParams: ensureObject(operation, pathParams, "pathParams"),
    files: ensureObject(operation, files, "files"),
  };
}

function extractPathParams(operation, payload, pathParams) {
  for (const match of operation.path.matchAll(PATH_PARAMETER)) {
    const name = match[1];
    const alias = name === "id" && operation.id === "video.status" ? "video_id" : name;
    const value = pathParams[name] ?? pathParams[alias] ?? payload[name] ?? payload[alias];
    pathParams[name] = normalizeIdentifier(operation, name, value);
    delete payload[name];
    if (alias !== name) delete payload[alias];
  }
}

function extractQueryParams(operation, payload, query) {
  for (const name of QUERY_FIELDS[operation.id] ?? []) {
    if (query[name] === undefined && payload[name] !== undefined) query[name] = payload[name];
    delete payload[name];
  }
}

function ensureObject(operation, value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(operation, `${label} must be an object.`);
  }
  return value;
}
