import { serializeError } from "../core/errors.js";

export function formatSuccess(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatError(error) {
  return `${JSON.stringify(serializeError(error), null, 2)}\n`;
}
