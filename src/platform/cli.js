import fs from "node:fs/promises";
import path from "node:path";
import JSONBigFactory from "json-bigint";

import { PixverseCliError } from "../core/errors.js";
import { requestHttp } from "../core/http.js";
import { redact, redactHeaders } from "../core/redaction.js";
import { createTraceId } from "../core/trace.js";
import { PlatformClient } from "./client.js";
import { getPlatformConfig } from "./config.js";
import { PLATFORM_OPERATIONS, matchPlatformCommand } from "./operations.js";
import { buildPlatformRequest } from "./request.js";
import { normalizeAndValidatePlatformInput } from "./validation.js";

const JSON_BIG = JSONBigFactory({
  storeAsString: true,
  protoAction: "error",
  constructorAction: "error",
});
const RAW_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const INPUT_OPTIONAL_OPERATIONS = new Set([
  "account.balance",
  "account.usage",
  "resource.templates",
  "resource.tts-speakers",
]);

export async function runPlatformCommand(args, context = {}) {
  if (args[0] === "raw") return runRawCommand(args.slice(1), context);

  const operation = matchPlatformCommand(args);
  if (!operation) throw cliError("Unknown Platform command.", "UNKNOWN_PLATFORM_COMMAND");
  const options = parseSpecializedOptions(args.slice(2), operation);
  const input = await resolveSpecializedInput(operation, options, context);

  if (options.dryRun) return createDryRun(operation, input, context);

  const client = context.client ?? createClient(context);
  return client.execute(operation.id, input, {
    inspectLocalMedia: context.inspectLocalMedia,
    signal: context.signal,
  });
}

export function getPlatformHelp() {
  const commands = PLATFORM_OPERATIONS.map(({ command }) => (
    `  pixverse-api platform ${command.join(" ")} [--payload <path>] [--dry-run]`
  ));
  commands.push("  pixverse-api platform raw <method> </openapi/v2/path> [--payload <path>] [--header <name:value>]");
  return `Usage:\n${commands.join("\n")}`;
}

function createClient(context) {
  const options = getPlatformOptions(context);
  if (context.fetchImpl) options.fetchImpl = context.fetchImpl;
  if (context.sleep) options.sleep = context.sleep;
  if (context.inspectLocalMedia) options.inspectLocalMedia = context.inspectLocalMedia;
  return new PlatformClient(options);
}

function getPlatformOptions(context) {
  try {
    return { ...getPlatformConfig(context.env) };
  } catch (cause) {
    throw new PixverseCliError(cause.message, {
      category: "configuration",
      provider: "platform",
      code: "PLATFORM_CONFIGURATION",
      retryable: false,
      cause,
    });
  }
}

async function createDryRun(operation, input, context) {
  const normalized = await normalizeAndValidatePlatformInput(operation, input, {
    inspectLocalMedia: context.inspectLocalMedia,
  });
  const request = await buildPlatformRequest(operation, normalized);
  return redact({
    dry_run: true,
    operation: operation.id,
    request: {
      method: request.method,
      path: request.path,
      body_mode: operation.bodyMode,
      headers: redactHeaders(request.headers),
      normalized: safeDryRunNormalized(normalized),
    },
  });
}

function safeDryRunNormalized(normalized) {
  return {
    ...normalized,
    payload: { ...normalized.payload },
    query: { ...normalized.query },
    pathParams: { ...normalized.pathParams },
    files: Object.fromEntries(Object.entries(normalized.files).map(([name, filePath]) => [name, {
      supplied: true,
      basename: path.basename(filePath),
      inspected: normalized.validationSummary?.inspected_media === true,
    }])),
    validationSummary: { ...normalized.validationSummary },
  };
}

function parseSpecializedOptions(args, operation) {
  const options = { positional: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--payload") options.payloadPath = readOptionValue(args, ++index, arg);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--trace-id") throw cliError("Caller trace reuse is allowed only by an explicit recovery command.", "TRACE_REUSE_FORBIDDEN", operation.id);
    else if (arg.startsWith("--")) throw cliError("Unknown Platform option.", "UNKNOWN_PLATFORM_OPTION", operation.id);
    else options.positional.push(arg);
  }
  return options;
}

async function resolveSpecializedInput(operation, options, context) {
  let input = options.payloadPath
    ? await readPayload(options.payloadPath, context.cwd)
    : {};
  if (options.positional.length === 0) {
    if (!options.payloadPath && operationRequiresInput(operation)) {
      throw cliError(`${operation.command.join(" ")} requires --payload <path> or its documented positional input.`, "PLATFORM_INPUT_REQUIRED", operation.id);
    }
    return input;
  }
  if (options.payloadPath) throw cliError("Positional input cannot be combined with --payload.", "AMBIGUOUS_PLATFORM_INPUT", operation.id);
  if (options.positional.length !== 1) throw cliError(`${operation.command.join(" ")} accepts at most one positional input.`, "INVALID_PLATFORM_ARGUMENTS", operation.id);
  const [value] = options.positional;
  const field = positionalField(operation.id);
  if (!field) throw cliError(`${operation.command.join(" ")} requires --payload <path>.`, "PLATFORM_PAYLOAD_REQUIRED", operation.id);
  input = { [field]: value };
  return input;
}

function operationRequiresInput(operation) {
  return !INPUT_OPTIONAL_OPERATIONS.has(operation.id);
}

function positionalField(operationId) {
  return {
    "upload.image": "image",
    "upload.media": "file",
    "video.status": "video_id",
    "image.status": "image_id",
    "voice.delete": "speaker_id",
  }[operationId];
}

async function runRawCommand(args, context) {
  const [rawMethod, rawPath, ...optionArgs] = args;
  const method = normalizeRawMethod(rawMethod);
  const requestPath = normalizeRawPath(rawPath);
  const options = parseRawOptions(optionArgs);
  const payload = options.payloadPath ? await readPayload(options.payloadPath, context.cwd) : undefined;
  const requestHeaders = new Headers(options.headers);
  let body;
  if (payload !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    body = JSON.stringify(payload);
  }

  if (options.dryRun) {
    return redact({
      dry_run: true,
      operation: "raw",
      request: { method, path: requestPath, headers: redactHeaders(requestHeaders), payload },
    });
  }

  const { apiKey, baseUrl } = getPlatformOptions(context);
  const traceId = createTraceId();
  requestHeaders.set("Accept", "application/json");
  requestHeaders.set("API-KEY", apiKey);
  requestHeaders.set("Ai-trace-id", traceId);
  const response = await requestHttp({
    url: new URL(requestPath, `${baseUrl}/`),
    method,
    headers: requestHeaders,
    body,
    fetchImpl: context.fetchImpl ?? globalThis.fetch,
    retry: { maxAttempts: 1 },
    sleep: context.sleep,
    now: context.now,
    provider: "platform",
    operation: "raw",
    traceId,
    signal: context.signal,
  });
  return {
    operation: "raw",
    traceId,
    status: response.status,
    data: response.body,
    retryAfter: response.retryAfter,
  };
}

function parseRawOptions(args) {
  const options = { headers: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--payload") options.payloadPath = readOptionValue(args, ++index, arg);
    else if (arg === "--header") options.headers.push(parseRawHeader(readOptionValue(args, ++index, arg)));
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") continue;
    else if (arg === "--trace-id") throw cliError("Raw access cannot reuse a caller trace ID.", "TRACE_REUSE_FORBIDDEN", "raw");
    else throw cliError("Unknown raw option.", "UNKNOWN_PLATFORM_OPTION", "raw");
  }
  return options;
}

function parseRawHeader(value) {
  if (/[\0-\x1f\x7f]/.test(value)) throw cliError("Raw headers cannot contain control characters.", "INVALID_RAW_HEADER", "raw");
  const separator = value.indexOf(":");
  if (separator < 1) throw cliError("--header requires a name:value pair.", "INVALID_RAW_HEADER", "raw");
  const name = value.slice(0, separator).trim();
  const headerValue = value.slice(separator + 1).trim();
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || isForbiddenRawHeader(name)) {
    throw cliError("Raw headers cannot override authentication or trace headers.", "FORBIDDEN_RAW_HEADER", "raw");
  }
  return [name, headerValue];
}

function isForbiddenRawHeader(name) {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized.endsWith("authorization")
    || normalized.endsWith("apikey")
    || normalized === "aitraceid"
    || normalized === "cookie"
    || normalized === "host"
    || normalized === "contentlength"
    || normalized === "transferencoding"
    || normalized === "connection"
    || normalized === "te"
    || normalized === "trailer"
    || normalized === "upgrade"
    || normalized === "keepalive"
    || normalized === "proxyconnection"
    || normalized === "proxyauthenticate";
}

function normalizeRawMethod(value) {
  const method = typeof value === "string" ? value.toUpperCase() : "";
  if (!RAW_METHODS.has(method)) throw cliError("Raw access requires an explicit supported HTTP method.", "INVALID_RAW_METHOD", "raw");
  return method;
}

function normalizeRawPath(value) {
  if (typeof value !== "string" || /[\r\n\\#]/.test(value) || !value.startsWith("/openapi/v2/")) {
    throw cliError("Raw access requires a relative /openapi/v2/ path.", "INVALID_RAW_PATH", "raw");
  }
  const decodedValue = repeatedlyDecode(value);
  const decoded = decodedValue.split(/[?#]/, 1)[0];
  if (/[\r\n\\]/.test(decodedValue)) {
    throw cliError("Raw path contains forbidden control or separator characters.", "INVALID_RAW_PATH", "raw");
  }
  const segments = decoded.split("/");
  if (decoded.includes("//") || segments.includes("..") || segments.includes(".")) {
    throw cliError("Raw path traversal is not allowed.", "INVALID_RAW_PATH", "raw");
  }
  const parsed = new URL(value, "https://pixverse.invalid");
  if (parsed.origin !== "https://pixverse.invalid" || !parsed.pathname.startsWith("/openapi/v2/")) {
    throw cliError("Raw path must remain within /openapi/v2/.", "INVALID_RAW_PATH", "raw");
  }
  return `${parsed.pathname}${parsed.search}`;
}

function repeatedlyDecode(value) {
  let decoded = value;
  for (let count = 0; count < 12; count += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw cliError("Raw path contains invalid percent encoding.", "INVALID_RAW_PATH", "raw");
    }
    if (next === decoded) break;
    decoded = next;
    if (count === 11) throw cliError("Raw path contains excessive nested encoding.", "INVALID_RAW_PATH", "raw");
  }
  return decoded;
}

async function readPayload(filePath, cwd = process.cwd()) {
  const resolved = path.resolve(cwd ?? process.cwd(), filePath);
  let body;
  try {
    body = await fs.readFile(resolved, "utf8");
  } catch (cause) {
    throw cliError(`Could not read Platform payload file: ${filePath}.`, "PLATFORM_PAYLOAD_READ_FAILED", undefined, cause);
  }
  let value;
  try {
    value = JSON_BIG.parse(body);
  } catch (cause) {
    throw cliError(`Platform payload is not valid JSON: ${filePath}.`, "INVALID_PLATFORM_PAYLOAD", undefined, cause);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw cliError("Platform payload must be a JSON object.", "INVALID_PLATFORM_PAYLOAD");
  }
  return value;
}

function readOptionValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw cliError(`${optionName} requires a value.`, "MISSING_PLATFORM_OPTION_VALUE");
  return value;
}

function cliError(message, code, operation, cause) {
  return new PixverseCliError(message, {
    category: "validation",
    provider: "platform",
    operation,
    code,
    retryable: false,
    cause,
  });
}
