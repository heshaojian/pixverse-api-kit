import { PixverseCliError } from "./errors.js";

export async function pollUntilTerminal(options) {
  const {
    poll,
    isTerminal,
    onSnapshot = async () => {},
    intervalMs = 3_000,
    timeoutMs = 10 * 60 * 1_000,
    sleep = defaultSleep,
    now = Date.now,
    provider,
    operation,
    traceId,
  } = options;
  validateOptions({ poll, isTerminal, intervalMs, timeoutMs });

  const startedAt = now();
  let lastSnapshot;

  while (true) {
    lastSnapshot = await poll();
    await onSnapshot(lastSnapshot);
    if (await isTerminal(lastSnapshot)) return lastSnapshot;

    const elapsed = now() - startedAt;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 0) {
      throw timeoutError({ provider, operation, traceId, timeoutMs, lastSnapshot });
    }
    await sleep(Math.min(intervalMs, remaining));
  }
}

function validateOptions({ poll, isTerminal, intervalMs, timeoutMs }) {
  if (typeof poll !== "function") throw new TypeError("poll must be a function.");
  if (typeof isTerminal !== "function") throw new TypeError("isTerminal must be a function.");
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError("intervalMs must be a positive number.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError("timeoutMs must be a non-negative number.");
  }
}

function timeoutError({ provider, operation, traceId, timeoutMs, lastSnapshot }) {
  return new PixverseCliError(`PixVerse polling timed out after ${timeoutMs}ms.`, {
    category: "timeout",
    provider,
    operation,
    traceId,
    retryable: false,
    details: {
      timeout_ms: timeoutMs,
      last_snapshot: lastSnapshot,
    },
  });
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
