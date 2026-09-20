import { redact } from "./redaction.js";

const PUBLIC_FIELDS = [
  ["category", "category"],
  ["provider", "provider"],
  ["operation", "operation"],
  ["status", "status"],
  ["code", "code"],
  ["retryable", "retryable"],
  ["retryAfter", "retry_after"],
  ["traceId", "trace_id"],
  ["requestId", "request_id"],
  ["details", "details"],
];

export class PixverseCliError extends Error {
  constructor(messageOrOptions, options = {}) {
    const input = typeof messageOrOptions === "object" && messageOrOptions !== null
      ? messageOrOptions
      : { ...options, message: messageOrOptions };
    super(input.message ?? "PixVerse CLI operation failed.", { cause: input.cause });
    this.name = "PixverseCliError";

    for (const [property] of PUBLIC_FIELDS) {
      if (input[property] !== undefined) this[property] = input[property];
    }
  }
}

export function serializeError(error) {
  const source = error instanceof Error ? error : new Error(String(error));
  const serialized = {
    name: source.name || "Error",
    message: source.message || String(source),
  };

  for (const [property, publicName] of PUBLIC_FIELDS) {
    if (source[property] !== undefined) serialized[publicName] = source[property];
  }

  return redact(serialized);
}
