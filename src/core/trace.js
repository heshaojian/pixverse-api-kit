import { randomUUID } from "node:crypto";

export function createTraceId() {
  return randomUUID();
}
