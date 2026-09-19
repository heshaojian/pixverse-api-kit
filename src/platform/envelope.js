import { PixverseCliError } from "../core/errors.js";

export function parsePlatformEnvelope(body, context = {}) {
  if (!isEnvelope(body)) {
    throw new PixverseCliError("Invalid Platform API response envelope.", {
      category: "response",
      provider: "platform",
      operation: context.operation,
      status: context.httpStatus,
      traceId: context.traceId,
      details: body,
    });
  }

  const errorCode = Number(body.ErrCode);
  if (errorCode !== 0) {
    throw new PixverseCliError(body.ErrMsg || `Platform API failed with ErrCode ${body.ErrCode}.`, {
      category: "provider",
      provider: "platform",
      operation: context.operation,
      status: context.httpStatus,
      code: body.ErrCode,
      traceId: context.traceId,
      retryable: false,
      details: body,
    });
  }

  return {
    envelope: body,
    data: body.Resp,
  };
}

function isEnvelope(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (!("ErrCode" in value)) return false;
  if (typeof value.ErrCode === "number") return Number.isFinite(value.ErrCode);
  return typeof value.ErrCode === "string" && /^\d+$/.test(value.ErrCode);
}
