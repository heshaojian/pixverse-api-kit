export class GrowthStudioApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GrowthStudioApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
  }
}

export function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(path, withTrailingSlash(baseUrl));
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
  const body = text ? safeJson(text) : {};

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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function withTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
