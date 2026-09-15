import fs from "node:fs";

export const DEFAULT_BASE_URL = "https://growth-api.pixverse.ai";

export function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return;

  const body = fs.readFileSync(path, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

export function getConfig(env = process.env) {
  const apiKey = env.PIXVERSE_GROWTH_API_KEY;
  const folderApiKey = env.PIXVERSE_GROWTH_FOLDER_API_KEY || apiKey;
  const folderApiPrefix = env.PIXVERSE_GROWTH_FOLDER_API_PREFIX;
  const baseUrl = env.PIXVERSE_GROWTH_BASE_URL || DEFAULT_BASE_URL;

  if (!apiKey) {
    throw new Error("Missing PIXVERSE_GROWTH_API_KEY. Add it to .env or the server environment.");
  }

  if (!apiKey.startsWith("mh_live_")) {
    throw new Error("PIXVERSE_GROWTH_API_KEY must be a production key starting with mh_live_.");
  }

  return { apiKey, folderApiKey, folderApiPrefix, baseUrl };
}
