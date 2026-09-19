import fs from "node:fs";
import path from "node:path";

import { PixverseCliError } from "../core/errors.js";

const PATH_PARAMETER = /\{([^}]+)\}/g;

export async function buildPlatformRequest(operation, normalizedInput) {
  assertRequestInputs(operation, normalizedInput);
  const requestPath = interpolatePath(operation, normalizedInput.pathParams);
  const query = operation.bodyMode === "none"
    ? { ...normalizedInput.payload, ...normalizedInput.query }
    : normalizedInput.query;
  const pathWithQuery = appendQuery(requestPath, query);
  const headers = new Headers();
  let body;

  if (operation.bodyMode === "json") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(normalizedInput.payload);
  } else if (operation.bodyMode === "multipart") {
    body = await buildMultipartBody(normalizedInput);
  } else if (operation.bodyMode !== "none") {
    throw requestError(operation, `Unsupported Platform body mode: ${operation.bodyMode}.`);
  }

  return {
    method: operation.method,
    path: pathWithQuery,
    headers,
    body,
  };
}

function interpolatePath(operation, pathParams) {
  return operation.path.replace(PATH_PARAMETER, (_, name) => {
    const value = pathParams[name];
    if (typeof value !== "string" || value === "") {
      throw requestError(operation, `Missing normalized path parameter: ${name}.`);
    }
    return encodeURIComponent(value);
  });
}

function appendQuery(requestPath, query) {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(name, serializeField(item));
    } else {
      search.append(name, serializeField(value));
    }
  }
  const suffix = search.toString();
  return suffix === "" ? requestPath : `${requestPath}?${suffix}`;
}

async function buildMultipartBody(normalizedInput) {
  const form = new FormData();
  for (const [name, value] of Object.entries(normalizedInput.payload)) {
    if (value !== undefined && value !== null) form.append(name, serializeField(value));
  }
  for (const [name, filePath] of Object.entries(normalizedInput.files)) {
    const blob = await fs.openAsBlob(filePath);
    form.append(name, blob, path.basename(filePath));
  }
  return form;
}

function serializeField(value) {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function assertRequestInputs(operation, normalizedInput) {
  if (!operation || typeof operation !== "object") {
    throw new TypeError("A Platform operation is required.");
  }
  for (const name of ["payload", "query", "pathParams", "files"]) {
    const value = normalizedInput?.[name];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw requestError(operation, `Normalized Platform ${name} must be an object.`);
    }
  }
}

function requestError(operation, message) {
  return new PixverseCliError(message, {
    category: "validation",
    provider: "platform",
    operation: operation?.id,
    code: "INVALID_PLATFORM_REQUEST",
    retryable: false,
  });
}
