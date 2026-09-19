import fs from "node:fs";
import path from "node:path";
import {
  assertVideoId,
  validateCreatePayload,
  validateEditPayload,
  validateFolderPayload,
} from "./validation.js";

export {
  validateCreatePayload,
  validateEditPayload,
  validateFolderPayload,
} from "./validation.js";

const API_PREFIX = "/openapi/v1";
const DEFAULT_FOLDER_API_PREFIX = "/marketing_hub";
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

export class GrowthStudioApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GrowthStudioApiError";
    this.category = options.category;
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
  }
}

export function buildUrl(baseUrl, requestPath, query = {}) {
  const url = new URL(requestPath, withTrailingSlash(baseUrl));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function getRetryAfterSeconds(headers) {
  const value = headers.get("retry-after");
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return undefined;
}

export async function parseResponse(response) {
  const requestId = response.headers.get("x-request-id");
  const retryAfter = getRetryAfterSeconds(response.headers);
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new GrowthStudioApiError("PixVerse API returned invalid JSON in a successful response.", {
          category: "protocol",
          status: response.status,
          code: "INVALID_JSON_RESPONSE",
          retryable: false,
          requestId,
        });
      }
    }
  }

  if (!response.ok) {
    const error = body.error || {};
    throw new GrowthStudioApiError(error.message || `PixVerse API request failed with HTTP ${response.status}.`, {
      status: response.status,
      code: error.code,
      retryable: error.retryable,
      requestId: body.request_id || requestId,
      retryAfter,
      details: error.details,
    });
  }

  return {
    body,
    headers: response.headers,
    requestId: body.request_id || requestId,
    retryAfter,
  };
}

export class GrowthStudioClient {
  constructor({
    apiKey,
    folderApiKey,
    folderApiPrefix = DEFAULT_FOLDER_API_PREFIX,
    baseUrl,
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
  }) {
    if (!fetchImpl) throw new Error("A fetch implementation is required.");
    this.apiKey = apiKey;
    this.folderApiKey = folderApiKey || apiKey;
    this.folderApiPrefix = normalizeApiPrefix(folderApiPrefix);
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
    this.sleep = sleep;
  }

  async listAvatars(options = {}) {
    return this.request("GET", "/avatars", { traceId: options.traceId });
  }

  async uploadImage(filePath, options = {}) {
    const file = await fs.openAsBlob(filePath);
    const form = new FormData();
    form.set("image", file, path.basename(filePath));
    return this.request("POST", "/image/upload", {
      body: form,
      traceId: options.traceId,
    });
  }

  async createVideo(payload, options = {}) {
    validateCreatePayload(payload);
    return this.request("POST", "/videos", {
      json: payload,
      traceId: options.traceId,
    });
  }

  async getVideo(videoId, options = {}) {
    assertVideoId(videoId);
    return this.request("GET", `/videos/${encodeURIComponent(videoId)}`, {
      traceId: options.traceId,
    });
  }

  async listVideos(options = {}) {
    return this.request("GET", "/videos", {
      query: {
        limit: options.limit,
        status: options.status,
        cursor: options.cursor,
      },
      traceId: options.traceId,
    });
  }

  async listFolders(options = {}) {
    return this.requestFolderApi("GET", "/folder/list", {
      traceId: options.traceId,
    });
  }

  async createFolder(payload, options = {}) {
    validateFolderPayload(payload);
    return this.requestFolderApi("POST", "/folder/create", {
      json: payload,
      traceId: options.traceId,
    });
  }

  async editVideo(videoId, payload, options = {}) {
    assertVideoId(videoId);
    validateEditPayload(payload);
    return this.request("POST", `/videos/${encodeURIComponent(videoId)}/edit`, {
      json: payload,
      traceId: options.traceId,
    });
  }

  async pollVideo(videoId, options = {}) {
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
    const startedAt = Date.now();
    let waitSeconds = options.initialDelaySeconds ?? 5;

    while (true) {
      if (waitSeconds > 0) await this.sleep(waitSeconds * 1000);

      const result = await this.getVideo(videoId, { traceId: options.traceId });
      const body = result.body;
      const editStatus = body.edit?.latest?.status || body.edit?.status;
      await options.onSnapshot?.(body);

      if (TERMINAL_STATUSES.has(body.status) && !isEditRunning(editStatus)) {
        return body;
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Polling timed out for video_id ${videoId}.`);
      }

      waitSeconds = result.retryAfter ?? options.fallbackDelaySeconds ?? 5;
    }
  }

  async request(method, path, options = {}) {
    const url = buildUrl(this.baseUrl, `${API_PREFIX}${path}`, options.query);
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Accept", "application/json");
    if (options.traceId) headers.set("Ai-Trace-Id", options.traceId);

    let body = options.body;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }

    return parseResponse(await this.fetch(url, { method, headers, body }));
  }

  async requestFolderApi(method, path, options = {}) {
    const url = buildUrl(this.baseUrl, `${this.folderApiPrefix}${path}`, options.query);
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.folderApiKey}`);
    headers.set("Accept", "application/json");
    if (options.traceId) headers.set("Ai-Trace-Id", options.traceId);

    let body = options.body;
    if (options.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }

    const response = await parseResponse(await this.fetch(url, { method, headers, body }));
    return {
      ...response,
      body: unwrapFolderApiEnvelope(response.body),
    };
  }
}

export function createProductUrlPayload(sourceUrl, video = {}) {
  return {
    ...(video.folderId ? { folder_id: video.folderId } : {}),
    product: {
      source_url: sourceUrl,
    },
    video: {
      aspect_ratio: video.aspectRatio || "9:16",
      duration_seconds: video.durationSeconds || 30,
      resolution: video.resolution || "1080p",
      language: video.language || "en-US",
      voiceover: video.voiceover ?? true,
      captions: video.captions ?? true,
      background_music: video.backgroundMusic ?? true,
      avatar: video.avatar || { mode: "auto" },
    },
    ...(video.metadata ? { metadata: video.metadata } : {}),
  };
}

function unwrapFolderApiEnvelope(body) {
  if (body && typeof body === "object" && "ErrCode" in body && body.ErrCode !== 0) {
    const error = new Error(body.ErrMsg || `Growth Studio folder request failed with code ${body.ErrCode}.`);
    error.code = body.ErrCode;
    error.details = body.Resp;
    throw error;
  }

  if (body && typeof body === "object" && "Resp" in body) return body.Resp || {};
  return body;
}

function normalizeApiPrefix(prefix) {
  if (!prefix || typeof prefix !== "string") return DEFAULT_FOLDER_API_PREFIX;
  const trimmed = prefix.trim();
  if (!trimmed) return DEFAULT_FOLDER_API_PREFIX;
  const withoutTrailingSlash = trimmed.replace(/\/+$/g, "");
  return withoutTrailingSlash.startsWith("/") ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

function isEditRunning(status) {
  return status === "queued" || status === "processing";
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
