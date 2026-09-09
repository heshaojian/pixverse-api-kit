import fs from "node:fs";
import path from "node:path";
import { buildUrl, parseResponse } from "./http.js";

const API_PREFIX = "/openapi/v1";
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

export class GrowthStudioClient {
  constructor({ apiKey, baseUrl, fetchImpl = globalThis.fetch, sleep = defaultSleep }) {
    if (!fetchImpl) throw new Error("A fetch implementation is required.");
    this.apiKey = apiKey;
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
}

export function createProductUrlPayload(sourceUrl, video = {}) {
  return {
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

export function validateCreatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Create payload must be an object.");
  if (!payload.product || typeof payload.product !== "object") throw new Error("Create payload requires product.");
  if (!payload.video || typeof payload.video !== "object") throw new Error("Create payload requires video.");

  if (!payload.product.source_url && !Array.isArray(payload.product.images)) {
    throw new Error("Create payload requires product.source_url or product.images from the upload endpoint.");
  }

  for (const image of payload.product.images || []) {
    if (!image.url || !image.url.startsWith("https://media.pixverse.ai/")) {
      throw new Error("Product images must use URLs returned by the image upload endpoint.");
    }
  }
}

export function validateEditPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Edit payload must be an object.");
  if (!Number.isInteger(payload.clip_index) || payload.clip_index < 1) {
    throw new Error("clip_index must be a one-based positive integer.");
  }
  if (!payload.instruction || typeof payload.instruction !== "string") {
    throw new Error("instruction is required.");
  }
}

function assertVideoId(videoId) {
  if (typeof videoId !== "string" || !/^\d+$/.test(videoId)) {
    throw new Error("video_id must be a numeric string.");
  }
}

function isEditRunning(status) {
  return status === "queued" || status === "processing";
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
