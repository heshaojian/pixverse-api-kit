import { createHmac, timingSafeEqual } from "node:crypto";

import JSONBigFactory from "json-bigint";

import { PixverseCliError } from "../core/errors.js";

const JSON_BIG = JSONBigFactory({
  storeAsString: true,
  protoAction: "error",
  constructorAction: "error",
});
const MAX_BODY_BYTES = 1_048_576;
const MAX_SECRET_BYTES = 4_096;
const MAX_NONCE_BYTES = 256;
const MAX_TRACE_ID_BYTES = 256;
const MAX_TIMESTAMP_SKEW_SECONDS = 300;
const MAX_NONCES = 10_000;
const DEFAULT_COMMIT_TIMEOUT_MS = 5_000;
const MAX_COMMIT_TIMEOUT_MS = 60_000;
const REQUIRED_HEADERS = new Map([
  ["webhook-timestamp", "timestamp"],
  ["webhook-nonce", "nonce"],
  ["webhook-signature", "signature"],
]);

export function createMemoryNonceStore(options = {}) {
  const maxEntries = positiveInteger(options.maxEntries, MAX_NONCES);
  const entries = new Map();
  function reserve(nonce, expiresAt, nowSeconds) {
    for (const [storedNonce, entry] of entries) {
      if (entry.expiresAt < nowSeconds) entries.delete(storedNonce);
    }
    if (entries.has(nonce)) return undefined;
    if (entries.size >= maxEntries) throw webhookError(
      "Webhook replay protection is temporarily unavailable.",
      "WEBHOOK_NONCE_STORE_FULL",
      503,
    );
    const token = Symbol("webhook-nonce-reservation");
    entries.set(nonce, { expiresAt, state: "reserved", token });
    return Object.freeze({
      commit() {
        const entry = entries.get(nonce);
        if (entry?.state !== "reserved" || entry.token !== token) return false;
        entries.set(nonce, { expiresAt: entry.expiresAt, state: "committed" });
        return true;
      },
      release() {
        const entry = entries.get(nonce);
        if (entry?.state !== "reserved" || entry.token !== token) return false;
        entries.delete(nonce);
        return true;
      },
    });
  }
  return Object.freeze({
    reserve,
    consume(nonce, expiresAt, nowSeconds) {
      const reservation = reserve(nonce, expiresAt, nowSeconds);
      return reservation ? reservation.commit() : false;
    },
  });
}

export async function verifyPlatformWebhook(options = {}) {
  const rawBody = normalizeRawBody(options.rawBody);
  const secret = requireBoundedString(options.secret, "webhook secret", MAX_SECRET_BYTES, {
    code: "WEBHOOK_CONFIGURATION_INVALID",
    statusCode: 500,
  });
  const headers = normalizeHeaders(options.headers);
  const timestamp = requiredHeader(headers, "webhook-timestamp");
  const nonce = requiredHeader(headers, "webhook-nonce");
  const signature = requiredHeader(headers, "webhook-signature");
  const traceId = optionalHeader(headers, "ai-trace-id", MAX_TRACE_ID_BYTES);

  requireBoundedString(nonce, "webhook nonce", MAX_NONCE_BYTES, {
    code: "WEBHOOK_HEADER_INVALID", statusCode: 401,
  });
  if (!/^[0-9]{1,13}$/.test(timestamp)) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_TIMESTAMP_INVALID", 401);
  }
  const timestampSeconds = unixSeconds(Number(timestamp));
  const nowSeconds = unixSeconds(resolveNow(options.now));
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_TIMESTAMP_OUT_OF_RANGE", 401);
  }

  const payload = parsePlatformWebhook(rawBody);
  const [insertionOrderQuery, sortedQuery] = canonicalWebhookQueries(payload);
  const insertionExpected = signWebhookQuery(secret, timestamp, nonce, insertionOrderQuery);
  const sortedExpected = signWebhookQuery(secret, timestamp, nonce, sortedQuery);
  const supplied = decodeSha256Signature(signature);
  const matchesInsertionOrder = timingSafeEqual(insertionExpected, supplied);
  const matchesSortedOrder = timingSafeEqual(sortedExpected, supplied);
  if ((Number(matchesInsertionOrder) | Number(matchesSortedOrder)) === 0) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_SIGNATURE_INVALID", 401);
  }

  const nonceStore = options.nonceStore;
  if (!nonceStore || (typeof nonceStore.reserve !== "function"
    && !(typeof nonceStore.has === "function"
      && typeof nonceStore.add === "function"
      && typeof nonceStore.delete === "function"))) {
    throw webhookError(
      "Webhook replay protection is not configured.",
      "WEBHOOK_NONCE_STORE_INVALID",
      500,
    );
  }
  const reservation = typeof nonceStore.reserve === "function"
    ? await nonceStore.reserve(nonce, timestampSeconds + MAX_TIMESTAMP_SKEW_SECONDS, nowSeconds)
    : reserveSetLikeNonceStore(nonceStore, nonce);
  if (!reservation) throw webhookError("Webhook delivery was already received.", "WEBHOOK_REPLAY", 409);
  if (typeof reservation.commit !== "function" || typeof reservation.release !== "function") {
    throw webhookError(
      "Webhook replay protection returned an invalid reservation.",
      "WEBHOOK_NONCE_STORE_INVALID",
      500,
    );
  }

  return {
    timestamp,
    nonce,
    signature,
    traceId,
    payload,
    commit: () => reservation.commit(),
    release: () => reservation.release(),
  };
}

export function parsePlatformWebhook(rawBody) {
  const normalized = normalizeRawBody(rawBody);
  let payload;
  try {
    payload = JSON_BIG.parse(normalized);
  } catch (cause) {
    throw webhookError("Webhook payload is not valid JSON.", "WEBHOOK_PAYLOAD_INVALID", 400, cause);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw webhookError("Webhook payload must be a JSON object.", "WEBHOOK_PAYLOAD_INVALID", 400);
  }
  return toPlainJsonValue(payload);
}

export function createPlatformWebhookHandler(options = {}) {
  requireBoundedString(options.secret, "webhook secret", MAX_SECRET_BYTES, {
    code: "WEBHOOK_CONFIGURATION_INVALID", statusCode: 500,
  });
  if (typeof options.onDelivery !== "function") {
    throw webhookError("A webhook delivery callback is required.", "WEBHOOK_CONFIGURATION_INVALID", 500);
  }
  const nonceStore = options.nonceStore ?? createMemoryNonceStore();
  const commitTimeoutMs = normalizeCommitTimeout(options.commitTimeoutMs);

  return async function platformWebhookHandler(request, response) {
    let verification;
    let commitStarted = false;
    try {
      if (request.method !== "POST") {
        response.setHeader("allow", "POST");
        throw webhookError("Method not allowed.", "WEBHOOK_METHOD_NOT_ALLOWED", 405);
      }
      const rawBody = await readRawBody(request);
      verification = await verifyPlatformWebhook({
        rawBody,
        headers: request.rawHeaders ?? request.headers,
        secret: options.secret,
        now: options.now,
        nonceStore,
      });
      const context = {
        timestamp: verification.timestamp,
        nonce: verification.nonce,
        signature: verification.signature,
        traceId: verification.traceId,
      };
      await options.onDelivery(verification.payload, context);
      commitStarted = true;
      await commitNonceReservation(verification, commitTimeoutMs);
      verification = undefined;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("ok");
    } catch (error) {
      if (verification && !commitStarted) {
        try {
          await verification.release();
        } catch {
          // The response remains a failure; never disclose nonce-store internals.
        }
      }
      // A started durable commit has an ambiguous outcome. Releasing here could
      // admit a duplicate delivery, so only pre-commit failures are released.
      if (response.headersSent) {
        response.end();
        return;
      }
      const statusCode = safeStatusCode(error?.statusCode);
      response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
      response.end(statusCode === 500 ? "webhook delivery failed" : "webhook rejected");
    }
  };
}

async function readRawBody(request) {
  const declaredLength = Number(request.headers?.["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    request.resume();
    throw webhookError("Webhook body is too large.", "WEBHOOK_BODY_TOO_LARGE", 413);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      request.resume();
      throw webhookError("Webhook body is too large.", "WEBHOOK_BODY_TOO_LARGE", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function normalizeRawBody(rawBody) {
  let value;
  if (typeof rawBody === "string") value = rawBody;
  else if (Buffer.isBuffer(rawBody)) value = rawBody.toString("utf8");
  else throw webhookError("Webhook body must be raw text or bytes.", "WEBHOOK_BODY_INVALID", 400);
  if (Buffer.byteLength(value, "utf8") > MAX_BODY_BYTES) {
    throw webhookError("Webhook body is too large.", "WEBHOOK_BODY_TOO_LARGE", 413);
  }
  return value;
}

function normalizeHeaders(input) {
  if (!input || typeof input !== "object") {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_HEADER_MISSING", 401);
  }
  const entries = Array.isArray(input)
    ? rawHeaderEntries(input)
    : typeof input.entries === "function"
      ? [...input.entries()]
      : Object.entries(input);
  const normalized = new Map();
  for (const [rawName, rawValue] of entries) {
    const name = String(rawName).toLowerCase();
    if (!REQUIRED_HEADERS.has(name) && name !== "ai-trace-id") continue;
    if (normalized.has(name) || Array.isArray(rawValue)) {
      throw webhookError("Webhook authentication failed.", "WEBHOOK_HEADER_DUPLICATE", 401);
    }
    if (typeof rawValue !== "string") {
      throw webhookError("Webhook authentication failed.", "WEBHOOK_HEADER_INVALID", 401);
    }
    normalized.set(name, rawValue);
  }
  return normalized;
}

function rawHeaderEntries(headers) {
  if (headers.length % 2 !== 0) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_HEADER_INVALID", 401);
  }
  const entries = [];
  for (let index = 0; index < headers.length; index += 2) {
    entries.push([headers[index], headers[index + 1]]);
  }
  return entries;
}

function requiredHeader(headers, name) {
  const value = headers.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_HEADER_MISSING", 401);
  }
  return value;
}

function optionalHeader(headers, name, maxBytes) {
  const value = headers.get(name);
  if (value === undefined) return undefined;
  return requireBoundedString(value, name, maxBytes, {
    code: "WEBHOOK_HEADER_INVALID", statusCode: 401, allowEmpty: true,
  });
}

function requireBoundedString(value, label, maxBytes, options = {}) {
  const isEmpty = typeof value !== "string" || (!options.allowEmpty && value.length === 0);
  if (isEmpty || Buffer.byteLength(value ?? "", "utf8") > maxBytes) {
    throw webhookError(
      options.statusCode === 401 ? "Webhook authentication failed." : `Invalid ${label}.`,
      options.code,
      options.statusCode,
    );
  }
  return value;
}

function decodeSha256Signature(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_SIGNATURE_INVALID", 401);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw webhookError("Webhook authentication failed.", "WEBHOOK_SIGNATURE_INVALID", 401);
  }
  return decoded;
}

function canonicalWebhookQueries(payload) {
  const entries = Object.entries(payload).map(([key, value]) => {
    if (value === null || typeof value === "object") {
      throw webhookError(
        "Webhook payload contains a value unsupported by the documented signature format.",
        "WEBHOOK_PAYLOAD_UNSUPPORTED",
        400,
      );
    }
    return [key, String(value)];
  });
  const insertionOrder = new URLSearchParams(entries).toString();
  const sortedEntries = [...entries].sort(([left], [right]) => left.localeCompare(right));
  return [insertionOrder, new URLSearchParams(sortedEntries).toString()];
}

function signWebhookQuery(secret, timestamp, nonce, query) {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${nonce}\n${query}`)
    .digest();
}

function reserveSetLikeNonceStore(store, nonce) {
  if (store.has(nonce)) return undefined;
  store.add(nonce);
  let state = "reserved";
  return Object.freeze({
    commit() {
      if (state !== "reserved") return false;
      state = "committed";
      return true;
    },
    release() {
      if (state !== "reserved") return false;
      state = "released";
      return store.delete(nonce);
    },
  });
}

async function commitNonceReservation(verification, timeoutMs) {
  let timeout;
  try {
    const committed = await Promise.race([
      Promise.resolve().then(() => verification.commit()),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(webhookError(
          "Webhook replay protection commit timed out.",
          "WEBHOOK_NONCE_COMMIT_TIMEOUT",
          500,
        )), timeoutMs);
      }),
    ]);
    if (committed !== true) {
      throw webhookError(
        "Webhook replay protection commit failed.",
        "WEBHOOK_NONCE_COMMIT_FAILED",
        500,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

function resolveNow(now) {
  const value = typeof now === "function" ? now() : Date.now();
  if (value instanceof Date) return value.getTime();
  if (!Number.isFinite(value)) {
    throw webhookError("Webhook clock is invalid.", "WEBHOOK_CONFIGURATION_INVALID", 500);
  }
  return value;
}

function unixSeconds(value) {
  return Math.floor(Math.abs(value) >= 100_000_000_000 ? value / 1_000 : value);
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizeCommitTimeout(value) {
  if (value === undefined) return DEFAULT_COMMIT_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_COMMIT_TIMEOUT_MS) {
    throw webhookError("Invalid webhook commit timeout.", "WEBHOOK_CONFIGURATION_INVALID", 500);
  }
  return value;
}

function safeStatusCode(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500;
}

function toPlainJsonValue(value) {
  if (Array.isArray(value)) return value.map((item) => toPlainJsonValue(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toPlainJsonValue(entry)]));
  }
  return value;
}

function webhookError(message, code, statusCode, cause) {
  const error = new PixverseCliError(message, {
    category: "webhook",
    provider: "platform",
    operation: "webhook.verify",
    code,
    retryable: false,
    cause,
  });
  error.statusCode = statusCode;
  return error;
}
