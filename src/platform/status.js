const PLATFORM_STATUS_NAMES = new Map([
  [1, "succeeded"],
  [5, "processing"],
  [6, "deleted"],
  [7, "moderation_failed"],
  [8, "failed"],
]);

const TERMINAL_PLATFORM_STATUSES = new Set([1, 6, 7, 8]);

export function normalizePlatformStatus(rawStatus) {
  const statusCode = normalizeStatusCode(rawStatus);
  return {
    status: PLATFORM_STATUS_NAMES.get(statusCode) ?? "unknown",
    rawStatus,
    terminal: TERMINAL_PLATFORM_STATUSES.has(statusCode),
  };
}

function normalizeStatusCode(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return value;
}
