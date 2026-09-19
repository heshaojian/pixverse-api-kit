const REDACTED = "[REDACTED]";

export function redact(value) {
  return redactValue(value, new WeakMap());
}

export function redactHeaders(headers) {
  const entries = headers instanceof Headers
    ? headers.entries()
    : Object.entries(headers ?? {});

  return Object.fromEntries(
    Array.from(entries, ([key, value]) => [key, isSensitiveKey(key) ? REDACTED : String(value)]),
  );
}

function redactValue(value, seen) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Headers) return redactHeaders(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (seen.has(value)) return "[Circular]";

  const output = Array.isArray(value) ? [] : {};
  seen.set(value, output);

  for (const [key, item] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, seen);
  }
  return output;
}

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized.endsWith("authorization")
    || normalized.endsWith("apikey")
    || normalized.endsWith("token")
    || normalized.endsWith("secret");
}
