export const DEFAULT_PLATFORM_BASE_URL = "https://app-api.pixverse.ai";
const OFFICIAL_PLATFORM_ORIGIN = new URL(DEFAULT_PLATFORM_BASE_URL).origin;

export function getPlatformConfig(env = process.env, options = {}) {
  const apiKey = options.apiKey ?? env.PIXVERSE_PLATFORM_API_KEY;
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? env.PIXVERSE_PLATFORM_BASE_URL ?? DEFAULT_PLATFORM_BASE_URL,
    options.allowCustomBaseUrl ?? env.PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL,
  );

  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error(
      "Missing PIXVERSE_PLATFORM_API_KEY. Add it to .env or the server environment.",
    );
  }

  return { apiKey, baseUrl };
}

function normalizeBaseUrl(value, allowCustomBaseUrl) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("PIXVERSE_PLATFORM_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw new TypeError("PIXVERSE_PLATFORM_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  const isOfficial = url.origin === OFFICIAL_PLATFORM_ORIGIN;
  const isLoopback = isLoopbackHostname(url.hostname);
  if (!isLoopback && url.protocol !== "https:") {
    throw new TypeError(
      "PIXVERSE_PLATFORM_BASE_URL must use the official HTTPS origin or an HTTPS custom base URL.",
    );
  }
  if (!isOfficial && !isLoopback && !isExplicitlyEnabled(allowCustomBaseUrl)) {
    throw new TypeError(
      "Custom PIXVERSE_PLATFORM_BASE_URL origins require PIXVERSE_PLATFORM_ALLOW_CUSTOM_BASE_URL=true.",
    );
  }

  return url.toString().replace(/\/$/, "");
}

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isExplicitlyEnabled(value) {
  return value === true || value === "true";
}
