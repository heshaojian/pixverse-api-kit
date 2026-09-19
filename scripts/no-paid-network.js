import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const BLOCKED_HOSTS = new Set([
  "app-api.pixverse.ai",
  "growth-api.pixverse.ai",
]);
const INSTALL_MARKER = Symbol.for("pixverse-api-kit.no-paid-network-installed");

export function assertSafeTestNetworkTarget(target) {
  const hostname = targetHostname(target);
  if (hostname && BLOCKED_HOSTS.has(hostname.toLowerCase())) {
    throw new Error(`Test blocked PixVerse production network access to ${hostname}.`);
  }
}

function targetHostname(target) {
  if (target instanceof URL) return target.hostname;
  if (typeof Request !== "undefined" && target instanceof Request) {
    return new URL(target.url).hostname;
  }
  if (typeof target === "string") {
    try {
      return new URL(target).hostname;
    } catch {
      return undefined;
    }
  }
  if (target && typeof target === "object") {
    const hostname = target.hostname ?? target.host;
    if (typeof hostname !== "string") return undefined;
    if (hostname.startsWith("[")) return hostname.slice(1, hostname.indexOf("]"));
    return hostname.split(":", 1)[0];
  }
  return undefined;
}

function installNoPaidNetworkGuard() {
  if (globalThis[INSTALL_MARKER]) return;
  Object.defineProperty(globalThis, INSTALL_MARKER, { value: true });

  if (typeof globalThis.fetch === "function") {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function guardedFetch(target, ...args) {
      assertSafeTestNetworkTarget(target);
      return Reflect.apply(originalFetch, this, [target, ...args]);
    };
  }

  guardRequestModule(http);
  guardRequestModule(https);
  syncBuiltinESMExports();
}

function guardRequestModule(module) {
  const originalRequest = module.request;
  module.request = function guardedRequest(target, ...args) {
    assertSafeTestNetworkTarget(target);
    return Reflect.apply(originalRequest, this, [target, ...args]);
  };

  const originalGet = module.get;
  module.get = function guardedGet(target, ...args) {
    assertSafeTestNetworkTarget(target);
    return Reflect.apply(originalGet, this, [target, ...args]);
  };
}

installNoPaidNetworkGuard();
