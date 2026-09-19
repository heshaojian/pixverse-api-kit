export const DEFAULT_PLATFORM_BASE_URL = "https://app-api.pixverse.ai";

export function getPlatformConfig(env = process.env, options = {}) {
  const apiKey = options.apiKey ?? env.PIXVERSE_PLATFORM_API_KEY;
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? env.PIXVERSE_PLATFORM_BASE_URL ?? DEFAULT_PLATFORM_BASE_URL,
  );

  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error(
      "Missing PIXVERSE_PLATFORM_API_KEY. Add it to .env or the server environment.",
    );
  }

  return { apiKey, baseUrl };
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("PIXVERSE_PLATFORM_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw new TypeError("PIXVERSE_PLATFORM_BASE_URL must be a valid HTTP or HTTPS URL.");
  }

  return url.toString().replace(/\/$/, "");
}
